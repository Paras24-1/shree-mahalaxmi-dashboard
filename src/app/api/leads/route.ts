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
// Body: Partial<Lead> & { conversation_id }
export async function PATCH(req: NextRequest) {
  try {
    const { conversation_id, ...updates } = await req.json()

    if (!conversation_id) {
      return NextResponse.json(
        { error: 'conversation_id is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update(updates)
      .eq('conversation_id', conversation_id)
      .select()
      .single()

    if (error) throw error

    // Sync name and stage back to conversations table
    if (updates.name || updates.stage) {
      await supabaseAdmin
        .from('conversations')
        .update({
          ...(updates.name  ? { name: updates.name }   : {}),
          ...(updates.stage ? { stage: updates.stage } : {}),
        })
        .eq('id', conversation_id)
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
