import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
// Body: Partial<Lead> & { conversation_id?: string; lead_id?: string; id?: string }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { conversation_id, lead_id, id, ...updates } = body

    const targetConvId = conversation_id || (lead_id ? undefined : id)
    const targetLeadId = id || lead_id

    if (!targetConvId && !targetLeadId) {
      return NextResponse.json(
        { error: 'conversation_id or lead id is required' },
        { status: 400 }
      )
    }

    let updatedLead = null

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

    // If lead doesn't exist yet in leads table, create/upsert it
    if (!updatedLead && targetConvId) {
      try {
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('name, phone_number, stage, assigned_to')
          .eq('id', targetConvId)
          .maybeSingle()

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from('leads')
          .insert({
            conversation_id: targetConvId,
            name: conv?.name || null,
            phone_number: conv?.phone_number || null,
            stage: updates.stage || conv?.stage || 'new',
            assigned_to: conv?.assigned_to || null,
            source: 'WhatsApp Direct',
            ...updates,
            created_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle()

        if (!insertError && inserted) {
          updatedLead = inserted
        }
      } catch (upsertErr) {
        console.error('Lead upsert failed:', upsertErr)
      }
    }

    // Sync name, stage, and notes back to conversations table
    const convIdToSync = targetConvId || updatedLead?.conversation_id
    if (convIdToSync) {
      const convUpdates: Record<string, any> = {}
      if (updates.name) convUpdates.name = updates.name
      if (updates.stage) convUpdates.stage = updates.stage
      if (updates.notes !== undefined) convUpdates.notes = updates.notes

      if (Object.keys(convUpdates).length > 0) {
        await supabaseAdmin
          .from('conversations')
          .update(convUpdates)
          .eq('id', convIdToSync)
      }
    }

    return NextResponse.json(updatedLead || { success: true, ...updates })
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
