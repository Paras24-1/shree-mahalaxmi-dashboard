import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/conversations
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search       = searchParams.get('search')        || ''
    const stage        = searchParams.get('stage')         || ''
    const unread       = searchParams.get('unread')        === 'true'
    const assignedTo   = searchParams.get('assigned_to')   || ''
    const assignFilter = searchParams.get('assign_filter') || ''

    let query = supabaseAdmin
      .from('conversations')
      .select(`
        *,
        lead:leads(*),
        assigned_user:users!conversations_assigned_to_fkey(id, name, email)
      `)
      .order('updated_at', { ascending: false })

    if (search) {
      query = query.or(`phone_number.ilike.%${search}%,name.ilike.%${search}%`)
    }
    if (stage) {
      query = query.eq('stage', stage)
    }
    if (unread) {
      query = query.gt('unread_count', 0)
    }

    // Employee: only see their assigned chats
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    }

    // Admin assign filter tabs
    if (assignFilter === 'unassigned') {
      query = query.is('assigned_to', null)
    } else if (assignFilter === 'assigned') {
      query = query.not('assigned_to', 'is', null)
    }

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
