import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getOrgId } from '@/lib/supabase'
import { isOsmoOrg, syncOsmoPhonebooks } from '@/lib/osmoPhonebooks'

export async function GET(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversation_id')
    if (!conversationId) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 })

    // First, try matching directly by conversation_id
    let { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (error) throw error

    // If not found by conversation_id, fall back to matching by phone number
    if (!data) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('phone_number')
        .eq('id', conversationId)
        .eq('org_id', orgId)
        .maybeSingle()

      if (conv?.phone_number) {
        const phone = conv.phone_number.replace(/\D/g, '').slice(-10)
        const { data: leadData, error: leadError } = await supabaseAdmin
          .from('leads')
          .select('*')
          .ilike('phone_number', `%${phone}`)
          .eq('org_id', orgId)
          .maybeSingle()

        if (leadError) throw leadError
        
        if (leadData) {
          data = leadData
          // Auto-heal/link the conversation_id
          await supabaseAdmin
            .from('leads')
            .update({ conversation_id: conversationId })
            .eq('id', data.id)
          data.conversation_id = conversationId
        }
      }
    }

    return NextResponse.json(data || {})
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { conversation_id, id: leadId, phone_number, metadata, ...updates } = body
    if (!conversation_id && !leadId && !phone_number) {
      return NextResponse.json({ error: 'lead identifier (id, conversation_id, or phone_number) required' }, { status: 400 })
    }

    let parsedMeta: any = metadata
    if (metadata && typeof metadata === 'string') {
      try { parsedMeta = JSON.parse(metadata) } catch (e) {}
    }

    // Move any fields that aren't valid DB columns into metadata
    const validDbColumns = [
      'id', 'conversation_id', 'phone_number', 'customer_name', 'name', 
      'created_at', 'org_id', 'metadata', 'followup_date', 'followup_notes', 
      'followup_notified', 'lead_temperature'
    ];

    let mergedMeta = { ...(parsedMeta || {}) };

    // Fetch existing lead to protect high-value lead_types from being downgraded to 'unfiltered'
    let existingLead: any = null
    if (leadId) {
      const res = await supabaseAdmin.from('leads').select('metadata').eq('id', leadId).eq('org_id', orgId).maybeSingle()
      existingLead = res.data
    }
    if (!existingLead && conversation_id) {
      const res = await supabaseAdmin.from('leads').select('metadata').eq('conversation_id', conversation_id).eq('org_id', orgId).maybeSingle()
      existingLead = res.data
    }
    if (!existingLead && phone_number) {
      const phone = String(phone_number).replace(/\D/g, '').slice(-10)
      const res = await supabaseAdmin.from('leads').select('metadata').ilike('phone_number', `%${phone}`).eq('org_id', orgId).maybeSingle()
      existingLead = res.data
    }

    const currentLeadType = (existingLead?.metadata?.lead_type || existingLead?.metadata?.category || '').toLowerCase()
    let targetLeadType = updates.lead_type || body.lead_type
    
    // Protect from downgrading
    const targetLower = targetLeadType?.toString().toLowerCase().trim() || ''
    const isDowngrade = ['unfiltered', 'unknown', 'none', 'null', 'na', 'n/a', ''].includes(targetLower)
    const isCurrentlyValid = currentLeadType && !['unfiltered', 'unknown', 'none', 'null', 'na', 'n/a', ''].includes(currentLeadType)

    if (isDowngrade && isCurrentlyValid) {
      targetLeadType = currentLeadType
      delete updates.lead_type
      delete body.lead_type
    }

    if (targetLeadType) {
      mergedMeta.lead_type = targetLeadType
      mergedMeta.category = targetLeadType
      mergedMeta.user_type = targetLeadType
      mergedMeta.Lead_Type = targetLeadType
    }

    // Calculate lead_quality & lead_temperature dynamically based on lead_score sent by n8n
    const sentScore = updates.lead_score ?? mergedMeta?.lead_score;
    if (sentScore !== undefined) {
      const numericScore = Number(sentScore);
      if (!isNaN(numericScore)) {
        let temp = 'COLD';
        if (numericScore >= 70) temp = 'HOT';
        else if (numericScore >= 40) temp = 'WARM';
        
        updates.lead_temperature = temp;
        mergedMeta.lead_quality = temp.toLowerCase();
        mergedMeta.lead_score = numericScore;
      }
    }

    // Move invalid columns from updates to metadata
    const finalUpdates: any = {};
    for (const key of Object.keys(updates)) {
      if (validDbColumns.includes(key)) {
        finalUpdates[key] = updates[key];
      } else {
        mergedMeta[key] = updates[key];
      }
    }

    finalUpdates.metadata = Object.keys(mergedMeta).length > 0 ? mergedMeta : null;

    let data: any = null
    let error: any = null

    // 1. Try updating by lead primary ID first if provided
    if (leadId) {
      const res = await supabaseAdmin
        .from('leads')
        .update(finalUpdates)
        .eq('id', leadId)
        .eq('org_id', orgId)
        .select()
        .maybeSingle()
      data = res.data
      error = res.error
    }

    // 2. Try updating by conversation_id if not yet found
    if (!data && conversation_id) {
      const res = await supabaseAdmin
        .from('leads')
        .update(finalUpdates)
        .eq('conversation_id', conversation_id)
        .eq('org_id', orgId)
        .select()
        .maybeSingle()
      data = res.data
      error = res.error
    }

    // 3. Fall back to matching by phone number
    const targetPhone = phone_number || data?.phone_number
    if (!data) {
      let searchPhone = targetPhone
      if (!searchPhone && conversation_id) {
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('phone_number')
          .eq('id', conversation_id)
          .eq('org_id', orgId)
          .maybeSingle()
        if (conv?.phone_number) searchPhone = conv.phone_number
      }

      if (searchPhone) {
        const phone = String(searchPhone).replace(/\D/g, '').slice(-10)
        const { data: leadData, error: leadError } = await supabaseAdmin
          .from('leads')
          .update({
            ...finalUpdates,
            ...(conversation_id ? { conversation_id } : {})
          })
          .ilike('phone_number', `%${phone}`)
          .eq('org_id', orgId)
          .select()
          .maybeSingle()

        if (leadError) throw leadError
        data = leadData || null
      }
    }

    // 4. If still not found and conversation_id exists, upsert a new lead row
    if (!data && conversation_id) {
      const { data: conv } = await supabaseAdmin
        .from('conversations')
        .select('phone_number, name')
        .eq('id', conversation_id)
        .eq('org_id', orgId)
        .maybeSingle()

      if (conv) {
        const { data: upsertData, error: upsertError } = await supabaseAdmin
          .from('leads')
          .upsert({
            ...finalUpdates,
            conversation_id,
            org_id: orgId,
            phone_number: conv.phone_number,
            name: conv.name || ''
          }, { onConflict: 'conversation_id' })
          .select()
          .maybeSingle()

        if (upsertError) throw upsertError
        data = upsertData || null
      }
    }

    if (error && !data) throw error

    // Sync conversations table if name, stage, or lead_type was updated
    const targetConvId = conversation_id || data?.conversation_id
    if (targetConvId) {
      if (updates.name || updates.stage || updates.lead_type) {
        let convMetaUpdate = undefined

        if (updates.lead_type) {
          const { data: cData } = await supabaseAdmin.from('conversations').select('metadata').eq('id', targetConvId).maybeSingle()
          let cMeta = cData?.metadata || {}
          if (typeof cMeta === 'string') try { cMeta = JSON.parse(cMeta) } catch {}
          cMeta = { ...cMeta, lead_type: updates.lead_type, category: updates.lead_type, user_type: updates.lead_type, Lead_Type: updates.lead_type }
          convMetaUpdate = cMeta
        }

        await supabaseAdmin
          .from('conversations')
          .update({
            ...(updates.name  ? { name: updates.name }   : {}),
            ...(updates.stage ? { stage: updates.stage } : {}),
            ...(convMetaUpdate ? { metadata: convMetaUpdate } : {})
          })
          .eq('id', targetConvId)
          .eq('org_id', orgId)
      }
    }

    // State-based assignment logic removed as per user request
    // For Osmo RO tenant, trigger auto phonebook sync in background
    isOsmoOrg(orgId).then((isOsmo) => {
      if (isOsmo) syncOsmoPhonebooks(orgId).catch(console.error)
    }).catch(() => {})

    return NextResponse.json(data || {})
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}