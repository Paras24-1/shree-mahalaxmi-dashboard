import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/lead-activities?lead_id=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('lead_id')

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

// POST /api/lead-activities
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { lead_id, activity_type, description, notes } = body

    if (!lead_id || !activity_type || !description) {
      return NextResponse.json(
        { error: 'lead_id, activity_type, and description are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('lead_activities')
      .insert({
        lead_id,
        activity_type,
        description,
        notes,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

// PATCH /api/lead-activities
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, description, notes } = body

    if (!id || !description) {
      return NextResponse.json(
        { error: 'id and description are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('lead_activities')
      .update({ description, notes })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

// DELETE /api/lead-activities?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('lead_activities')
      .delete()
      .eq('id', id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
