import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'
import { isOsmoOrg, syncOsmoPhonebooks } from '@/lib/osmoPhonebooks'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const profile = await getUserProfile(req)
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }

    const isStaffEmployee = profile.role !== 'owner' && profile.role !== 'admin'

    // Verify ownership of conversation first
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('id, assigned_to')
      .eq('id', id)
      .eq('org_id', profile.orgId)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (isStaffEmployee && conv.assigned_to !== profile.userId) {
      return NextResponse.json({ error: 'Forbidden: You can only delete conversations assigned to you' }, { status: 403 })
    }

    // 1. Delete assignment logs associated with this conversation
    await supabaseAdmin.from('assignment_logs').delete().eq('conversation_id', id)

    // 2. Delete conversation assignments associated with this conversation
    await supabaseAdmin.from('conversation_assignments').delete().eq('conversation_id', id)

    // 3. Since lead_activities is a child table referencing leads, find lead ID and delete activities first
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('conversation_id', id)
      .maybeSingle()

    if (lead) {
      await supabaseAdmin.from('lead_activities').delete().eq('lead_id', lead.id)
    }

    // 4. Delete leads
    await supabaseAdmin.from('leads').delete().eq('conversation_id', id)

    // 5. Delete messages
    await supabaseAdmin.from('messages').delete().eq('conversation_id', id)

    const { error } = await supabaseAdmin
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('org_id', profile.orgId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const profile = await getUserProfile(req)
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const body = await req.json()
    const isStaffEmployee = profile.role !== 'owner' && profile.role !== 'admin'

    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('id, assigned_to, metadata, phone_number, name')
      .eq('id', id)
      .eq('org_id', profile.orgId)
      .maybeSingle()

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (isStaffEmployee && conv.assigned_to !== profile.userId) {
      return NextResponse.json({ error: 'Forbidden: You can only update conversations assigned to you' }, { status: 403 })
    }

    // Only allow updating safe direct DB columns on conversations table
    const directDbColumns = isStaffEmployee 
      ? ['stage', 'notes', 'is_blocked'] 
      : ['stage', 'notes', 'assigned_to', 'assignment_status', 'is_blocked']
    
    const filteredBody: Record<string, any> = {}
    for (const key of directDbColumns) {
      if (key in body) {
        filteredBody[key] = body[key]
      }
    }

    // Handle explicit lead_type update
    if (body.lead_type !== undefined) {
      let convMeta = conv.metadata || {}
      if (typeof convMeta === 'string') {
        try { convMeta = JSON.parse(convMeta) } catch {}
      }
      convMeta = { 
        ...convMeta, 
        lead_type: body.lead_type,
        category: body.lead_type,
        user_type: body.lead_type,
        Lead_Type: body.lead_type
      }
      // Also update linked lead record metadata if it exists by conversation_id or phone
      let linkedLead: any = null
      const { data: leadByConv } = await supabaseAdmin
        .from('leads')
        .select('id, metadata, phone_number')
        .eq('conversation_id', id)
        .eq('org_id', profile.orgId)
        .maybeSingle()

      linkedLead = leadByConv

      if (!linkedLead && conv.phone_number) {
        const phone = conv.phone_number.replace(/\D/g, '').slice(-10)
        const { data: leadByPhone } = await supabaseAdmin
          .from('leads')
          .select('id, metadata, phone_number')
          .ilike('phone_number', `%${phone}`)
          .eq('org_id', profile.orgId)
          .maybeSingle()
        linkedLead = leadByPhone
      }

      if (linkedLead) {
        let leadMeta = linkedLead.metadata || {}
        if (typeof leadMeta === 'string') {
          try { leadMeta = JSON.parse(leadMeta) } catch {}
        }
        leadMeta = { 
          ...leadMeta, 
          lead_type: body.lead_type,
          category: body.lead_type,
          user_type: body.lead_type,
          Lead_Type: body.lead_type
        }
        await supabaseAdmin
          .from('leads')
          .update({ 
            metadata: leadMeta,
            conversation_id: id // ensure linked
          })
          .eq('id', linkedLead.id)
      } else if (conv.phone_number) {
        // Upsert lead record so it appears in CRM tables
        await supabaseAdmin
          .from('leads')
          .upsert({
            org_id: profile.orgId,
            conversation_id: id,
            phone_number: conv.phone_number,
            name: conv.name || '',
            metadata: { 
              lead_type: body.lead_type,
              category: body.lead_type,
              user_type: body.lead_type,
              Lead_Type: body.lead_type
            }
          }, { onConflict: 'conversation_id' })
      }
    }

    const { error } = await supabaseAdmin
      .from('conversations')
      .update(filteredBody)
      .eq('id', id)
      .eq('org_id', profile.orgId)

    if (error) throw error

    // Sync Osmo Phonebooks in background if lead_type was updated
    if (body.lead_type !== undefined) {
      isOsmoOrg(profile.orgId).then((isOsmo) => {
        if (isOsmo) syncOsmoPhonebooks(profile.orgId).catch(console.error)
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

