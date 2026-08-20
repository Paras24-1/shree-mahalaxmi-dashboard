import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const stage = searchParams.get('stage') || ''
    const unread = searchParams.get('unread') === 'true'
    const assignedTo = searchParams.get('assigned_to') || ''
    const assignFilter = searchParams.get('assign_filter') || ''

    let pageQuery = supabaseAdmin
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(300)

    // Employee: their assigned chats + new unassigned chats (so new chats are never hidden)
    if (assignedTo) {
      pageQuery = pageQuery.or(`assigned_to.eq.${assignedTo},assigned_to.is.null`)
    }

    // Admin assignment filter tabs
    if (assignFilter === 'unassigned') {
      pageQuery = pageQuery.is('assigned_to', null)
    } else if (assignFilter === 'assigned') {
      pageQuery = pageQuery.not('assigned_to', 'is', null)
    }

    if (search) {
      const cleanSearch = search.replace(/[,()"]/g, '').trim()
      if (cleanSearch) {
        pageQuery = pageQuery.or(`name.ilike.%${cleanSearch}%,phone_number.ilike.%${cleanSearch}%`)
      }
    }
    if (stage) {
      if (stage === 'interested') {
        pageQuery = pageQuery.in('stage', ['interested', 'callback_done_by_ai'])
      } else {
        pageQuery = pageQuery.eq('stage', stage)
      }
    }
    if (unread) pageQuery = pageQuery.gt('unread_count', 0)

    const { data, error } = await pageQuery
    if (error) throw error

    return NextResponse.json(data || [], {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (err: any) {
    console.error('[conversations error]', err)
    const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err))
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
