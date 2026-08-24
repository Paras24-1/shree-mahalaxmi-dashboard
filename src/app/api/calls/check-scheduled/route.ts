import { NextRequest, NextResponse } from 'next/server'
import { triggerVoiceAICall } from '@/lib/voiceAura'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  return handleCheck(req)
}

export async function POST(req: NextRequest) {
  return handleCheck(req)
}

async function handleCheck(req: NextRequest) {
  try {
    const now = new Date()
    const nowISO = now.toISOString()
    // Look back up to 24 hours so we don't re-trigger ancient records
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // 1. Fetch leads where followup_date <= now, followup_date >= yesterday, and followup_notified is false (or null)
    const { data: dueLeads, error: leadsErr } = await supabaseAdmin
      .from('leads')
      .select('id, name, phone_number, conversation_id, followup_date, followup_notes, followup_notified')
      .not('followup_date', 'is', null)
      .lte('followup_date', nowISO)
      .gte('followup_date', yesterday)
      .or('followup_notified.is.null,followup_notified.eq.false')
      .limit(20)

    if (leadsErr) throw leadsErr

    const results: any[] = []

    if (dueLeads && dueLeads.length > 0) {
      for (const lead of dueLeads) {
        let phone = lead.phone_number

        // If phone not in leads, try fetching from conversations table
        if (!phone && lead.conversation_id) {
          const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('phone_number, name')
            .eq('id', lead.conversation_id)
            .maybeSingle()
          if (conv) {
            phone = conv.phone_number
            if (!lead.name) lead.name = conv.name
          }
        }

        const notes = lead.followup_notes || ''
        const isVoiceAI = notes.includes('[Voice AI]')
        const isManual = notes.includes('[Manual Call]')
        const isWhatsApp = notes.includes('[WhatsApp]')

        // If explicitly set to Manual or WhatsApp, do NOT auto-dial customer!
        if (isManual || isWhatsApp) {
          // Just mark notified and record scheduled reminder activity
          await supabaseAdmin
            .from('leads')
            .update({
              followup_notified: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id)

          try {
            await supabaseAdmin.from('lead_activities').insert({
              lead_id: lead.id,
              activity_type: isWhatsApp ? 'message' : 'note',
              description: `Follow-up reminder due (${isWhatsApp ? 'WhatsApp Reminder' : 'Manual Employee Call'})`,
              notes: lead.followup_notes || 'Follow-up notification due',
            })
          } catch {}

          results.push({
            lead_id: lead.id,
            action: isWhatsApp ? 'whatsapp' : 'manual',
            status: 'reminder_notified_no_call',
          })
          continue
        }

        if (!phone) {
          results.push({ lead_id: lead.id, status: 'skipped_no_phone' })
          continue
        }

        // Trigger Voice AI Call
        const triggerRes = await triggerVoiceAICall({
          phoneNumber: phone,
          customerName: lead.name || 'Lead',
          leadId: lead.id,
          conversationId: lead.conversation_id,
          notes: lead.followup_notes || 'Scheduled follow-up AI call',
        })

        // Mark lead as notified so we do not trigger multiple times
        await supabaseAdmin
          .from('leads')
          .update({
            followup_notified: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id)

        // Log to lead activities
        try {
          await supabaseAdmin.from('lead_activities').insert({
            lead_id: lead.id,
            activity_type: 'call',
            description: `Automated Voice AI Follow-up Call Triggered at scheduled time (${new Date(lead.followup_date).toLocaleTimeString()})`,
            notes: lead.followup_notes || 'Voice Aura automated call trigger',
          })
        } catch (actErr) {
          console.error('[Activity Log Error]:', actErr)
        }

        results.push({
          lead_id: lead.id,
          phone,
          followup_date: lead.followup_date,
          status: triggerRes.success ? 'called' : 'trigger_failed',
          details: triggerRes,
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: nowISO,
      processed: results.length,
      results,
    })
  } catch (err: any) {
    console.error('[Check Scheduled Followups Error]:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
