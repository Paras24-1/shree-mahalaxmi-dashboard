import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

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
      .select('*')
      .order('updated_at', { ascending: false })

    // Employee: only their assigned chats
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    }

    // Admin assignment filter tabs
    if (assignFilter === 'unassigned') {
      query = query.is('assigned_to', null)
    } else if (assignFilter === 'assigned') {
      query = query.not('assigned_to', 'is', null)
    }

    if (search) query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`)
    if (stage)  query = query.eq('stage', stage)
    if (unread) query = query.gt('unread_count', 0)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err) {
    console.error('[conversations]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
