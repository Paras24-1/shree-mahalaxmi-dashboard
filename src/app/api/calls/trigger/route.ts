import { NextRequest, NextResponse } from 'next/server'
import { triggerVoiceAICall } from '@/lib/voiceAura'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      phone_number,
      phoneNumber,
      to_phone_number,
      phone,
      name,
      leadName,
      customer_name,
      source,
      notes,
      context,
      lead_id,
      conversation_id,
      organization_id,
    } = body

    const targetPhone = phone_number || phoneNumber || to_phone_number || phone
    const targetName = name || leadName || customer_name || 'IndiaMART Lead'
    const leadSource = source || body.lead_source || 'IndiaMART'

    if (!targetPhone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Standardize phone number format
    let cleanDigits = String(targetPhone).replace(/\D/g, '')
    if (cleanDigits.length === 10) {
      cleanDigits = '91' + cleanDigits
    }
    const canonicalPhone = cleanDigits.startsWith('+') ? cleanDigits : `+${cleanDigits}`

    // Parse context object if provided as string or object
    let ctx = context
    if (typeof ctx === 'string') {
      try {
        ctx = JSON.parse(ctx)
      } catch {}
    }

    // Build rich lead requirement notes from extracted parameters
    let formattedNotes = notes || ''
    if (ctx && typeof ctx === 'object') {
      const details: string[] = []
      if (ctx.product && ctx.product !== 'N/A') details.push(`Product: ${ctx.product}`)
      if (ctx.quantity && ctx.quantity !== 'N/A') details.push(`Quantity: ${ctx.quantity}`)
      if (ctx.flavor && ctx.flavor !== 'N/A') details.push(`Flavor: ${ctx.flavor}`)
      if (ctx.ice_cream_type && ctx.ice_cream_type !== 'N/A') details.push(`Ice Cream Type: ${ctx.ice_cream_type}`)
      if (ctx.brand && ctx.brand !== 'N/A') details.push(`Brand: ${ctx.brand}`)
      
      if (details.length > 0) {
        const detailsStr = details.join(' | ')
        formattedNotes = formattedNotes ? `${detailsStr}\n${formattedNotes}` : detailsStr
      }
    }
    if (!formattedNotes) {
      formattedNotes = 'IndiaMART Buy Requirement'
    }

    const nowIso = new Date().toISOString()

    // 1. Create or update conversation record in Supabase
    const { data: conversation, error: convErr } = await supabaseAdmin
      .from('conversations')
      .upsert(
        {
          phone_number: canonicalPhone,
          name: targetName,
          last_message: `📥 ${leadSource} Lead: ${formattedNotes}`,
          unread_count: 1,
          updated_at: nowIso,
        },
        { onConflict: 'phone_number' }
      )
      .select()
      .single()

    if (convErr) {
      console.error('[Calls Trigger Conv Error]:', convErr)
    }

    const targetConvId = conversation_id || conversation?.id

    // 2. Create or update lead record with 'IndiaMART' source tag
    let realLeadId = lead_id
    if (targetConvId) {
      try {
        const { data: leadData, error: leadErr } = await supabaseAdmin
          .from('leads')
          .upsert(
            {
              conversation_id: targetConvId,
              phone_number: canonicalPhone,
              name: targetName,
              source: leadSource, // Sets the IndiaMART tag in Dashboard
              notes: formattedNotes,
              machine_interest: (ctx?.product && ctx.product !== 'N/A') ? ctx.product : undefined,
              stage: 'new',
              updated_at: nowIso,
            },
            { onConflict: 'conversation_id' }
          )
          .select()
          .maybeSingle()

        if (!leadErr && leadData) {
          realLeadId = leadData.id
        }
      } catch (lErr) {
        console.error('[Calls Trigger Lead Error]:', lErr)
      }
    }

    // 3. Create initial incoming message in messages table
    if (targetConvId) {
      try {
        await supabaseAdmin.from('messages').insert({
          conversation_id: targetConvId,
          phone_number: canonicalPhone,
          message: `📥 New ${leadSource} Lead Received:\nName: ${targetName}\nPhone: ${canonicalPhone}\n${formattedNotes}`,
          direction: 'incoming',
          timestamp: nowIso,
        })
      } catch (msgErr) {
        console.error('[Calls Trigger Message Error]:', msgErr)
      }
    }

    // 4. Trigger Voice AI Call via Voice Aura
    const result = await triggerVoiceAICall({
      phoneNumber: canonicalPhone,
      customerName: targetName,
      leadId: realLeadId,
      conversationId: targetConvId,
      notes: formattedNotes,
      organizationId: organization_id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message, details: result.error }, { status: 500 })
    }

    // 5. Log activity in lead_activities
    if (realLeadId) {
      try {
        await supabaseAdmin.from('lead_activities').insert({
          lead_id: realLeadId,
          activity_type: 'call',
          description: `Voice AI Call Initiated for ${leadSource} Lead (${targetName})`,
          notes: formattedNotes,
        })
      } catch (actErr) {
        console.error('[Activity Log Error]:', actErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: `${leadSource} lead registered in dashboard and Voice AI call triggered successfully`,
      lead_id: realLeadId,
      conversation_id: targetConvId,
      data: result.data,
    })
  } catch (err: any) {
    console.error('[API Calls Trigger Error]:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
