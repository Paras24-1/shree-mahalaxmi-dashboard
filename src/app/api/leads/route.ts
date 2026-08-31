import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Valid columns that exist in the Supabase 'leads' table
const VALID_LEAD_COLUMNS = new Set([
  'name',
  'phone_number',
  'conversation_id',
  'stage',
  'source',
  'company_name',
  'notes',
  'followup_date',
  'followup_notes',
  'followup_notified',
  'assigned_to',
  'lead_score',
  'lead_quality',
  'lead_type',
  'machine_interest',
  'callback_ready',
  'conversation_summary',
  'metadata',
  'created_at',
  'updated_at',
])

// GET /api/leads or /api/leads?conversation_id=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const conversationId = searchParams.get('conversation_id')

    if (conversationId) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle()

      if (error) throw error
      return NextResponse.json(data || {})
    } else {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return NextResponse.json(data || [])
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

// PATCH /api/leads
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { conversation_id, lead_id, id, phone_number, followup_action_type, ...rawUpdates } = body

    const targetConvId = conversation_id || (lead_id ? undefined : id)
    const targetLeadId = id || lead_id
    const rawPhone = phone_number ? String(phone_number).replace(/\D/g, '') : ''

    if (!targetConvId && !targetLeadId && !rawPhone) {
      return NextResponse.json(
        { error: 'conversation_id, lead id, or phone_number is required' },
        { status: 400 }
      )
    }

    // Filter only valid columns to avoid Supabase schema cache rejection
    const updates: Record<string, any> = {}
    for (const [key, value] of Object.entries(rawUpdates)) {
      if (VALID_LEAD_COLUMNS.has(key)) {
        updates[key] = value
      }
    }

    // Embed action type into followup_notes if action type is specified
    if (followup_action_type && updates.followup_notes !== undefined) {
      const tag =
        followup_action_type === 'voice_ai'
          ? '[Voice AI]'
          : followup_action_type === 'manual'
          ? '[Manual Call]'
          : '[WhatsApp]'
      let currentNotes = (updates.followup_notes || '').replace(/^\[(Voice AI|Manual Call|WhatsApp)\]\s*/i, '')
      updates.followup_notes = currentNotes ? `${tag} ${currentNotes}` : tag
    }

    updates.updated_at = new Date().toISOString()

    let updatedLead = null

    // 1. Try update by lead ID
    if (targetLeadId) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .update(updates)
        .eq('id', targetLeadId)
        .select()
        .maybeSingle()

      if (!error && data) {
        updatedLead = data
      }
    }

    // 2. Try update by conversation_id
    if (!updatedLead && targetConvId) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .update(updates)
        .eq('conversation_id', targetConvId)
        .select()
        .maybeSingle()

      if (!error && data) {
        updatedLead = data
      }
    }

    // 3. Try update by phone number
    if (!updatedLead && rawPhone) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .update(updates)
        .or(`phone_number.eq.${rawPhone},phone_number.eq.+${rawPhone},phone_number.ilike.%${rawPhone.slice(-10)}%`)
        .select()
        .maybeSingle()

      if (!error && data) {
        updatedLead = data
      }
    }

    // 4. If lead doesn't exist yet in leads table, create/insert it
    if (!updatedLead && (targetConvId || rawPhone)) {
      try {
        let conv = null
        if (targetConvId) {
          const { data } = await supabaseAdmin
            .from('conversations')
            .select('id, name, phone_number, stage, assigned_to')
            .eq('id', targetConvId)
            .maybeSingle()
          conv = data
        }

        const newLeadPayload: Record<string, any> = {
          conversation_id: targetConvId || conv?.id || null,
          name: conv?.name || updates.name || null,
          phone_number: conv?.phone_number || rawPhone || updates.phone_number || null,
          stage: updates.stage || conv?.stage || 'new',
          assigned_to: conv?.assigned_to || updates.assigned_to || null,
          source: 'WhatsApp Direct',
          ...updates,
          created_at: new Date().toISOString(),
        }

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('leads')
          .insert(newLeadPayload)
          .select()
          .maybeSingle()

        if (!insertError && inserted) {
          updatedLead = inserted
        }
      } catch (upsertErr) {
        console.error('Lead upsert failed:', upsertErr)
      }
    }

    // 5. Sync name, stage, and notes back to conversations table
    const convIdToSync = targetConvId || updatedLead?.conversation_id
    const convUpdates: Record<string, any> = {}
    if (updates.name) convUpdates.name = updates.name
    if (updates.stage) convUpdates.stage = updates.stage
    if (updates.notes !== undefined) convUpdates.notes = updates.notes

    if (Object.keys(convUpdates).length > 0) {
      convUpdates.updated_at = new Date().toISOString()
      if (convIdToSync) {
        await supabaseAdmin
          .from('conversations')
          .update(convUpdates)
          .eq('id', convIdToSync)
      }
      if (targetLeadId && targetLeadId !== convIdToSync) {
        await supabaseAdmin
          .from('conversations')
          .update(convUpdates)
          .eq('id', targetLeadId)
      }
      if (rawPhone) {
        await supabaseAdmin
          .from('conversations')
          .update(convUpdates)
          .or(`phone_number.eq.${rawPhone},phone_number.eq.+${rawPhone},phone_number.ilike.%${rawPhone.slice(-10)}%`)
      }
    }

    // 5. Synchronize with schedules table if followup_date was set or cleared
    if (updates.followup_date !== undefined) {
      const leadName = updatedLead?.name || 'Customer'
      const title = `Follow-up: ${leadName}`

      if (updates.followup_date) {
        try {
          // Check if schedule already exists for this lead
          const { data: existingSched } = await supabaseAdmin
            .from('schedules')
            .select('id')
            .ilike('title', `%${leadName}%`)
            .maybeSingle()

          if (existingSched) {
            await supabaseAdmin
              .from('schedules')
              .update({
                scheduled_at: updates.followup_date,
                notes: updates.followup_notes || 'Lead Follow-up Reminder',
                type: 'reminder',
              })
              .eq('id', existingSched.id)
          } else {
            await supabaseAdmin.from('schedules').insert({
              title,
              scheduled_at: updates.followup_date,
              notes: updates.followup_notes || 'Lead Follow-up Reminder',
              type: 'reminder',
              created_at: new Date().toISOString(),
            })
          }
        } catch (schedErr) {
          console.error('Schedules sync error:', schedErr)
        }
      }
    }

    return NextResponse.json(updatedLead || { success: true, ...updates })
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
