import { NextRequest, NextResponse } from 'next/server'
import { triggerVoiceAICall } from '@/lib/voiceAura'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone_number, name, customer_name, lead_id, conversation_id, notes, organization_id } = body

    const targetPhone = phone_number || body.phoneNumber || body.to_phone_number || body.phone
    const targetName = name || customer_name || 'Customer'

    if (!targetPhone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    // Call Voice Aura API
    const result = await triggerVoiceAICall({
      phoneNumber: targetPhone,
      customerName: targetName,
      leadId: lead_id,
      conversationId: conversation_id,
      notes: notes || 'Manual CRM follow-up trigger',
      organizationId: organization_id,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.message, details: result.error }, { status: 500 })
    }

    // If lead_id or conversation_id is provided, log activity
    let realLeadId = lead_id
    if (!realLeadId && conversation_id) {
      const { data: leadData } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('conversation_id', conversation_id)
        .maybeSingle()
      if (leadData?.id) realLeadId = leadData.id
    }

    if (realLeadId) {
      try {
        await supabaseAdmin.from('lead_activities').insert({
          lead_id: realLeadId,
          activity_type: 'call',
          description: `Voice AI Call Initiated to ${targetName} (${targetPhone})`,
          notes: notes || 'Automated Voice Aura follow-up trigger',
        })
      } catch (actErr) {
        console.error('[Activity Log Error]:', actErr)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Voice AI call successfully triggered',
      data: result.data,
    })
  } catch (err: any) {
    console.error('[API Calls Trigger Error]:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
