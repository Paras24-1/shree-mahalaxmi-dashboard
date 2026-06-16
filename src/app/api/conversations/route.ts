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

    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      let pageQuery = supabaseAdmin
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      // Employee: only their assigned chats
      if (assignedTo) {
        pageQuery = pageQuery.eq('assigned_to', assignedTo)
      }

      // Admin assignment filter tabs
      if (assignFilter === 'unassigned') {
        pageQuery = pageQuery.is('assigned_to', null)
      } else if (assignFilter === 'assigned') {
        pageQuery = pageQuery.not('assigned_to', 'is', null)
      }

      if (search) pageQuery = pageQuery.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`)
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

      if (data && data.length > 0) {
        allData = [...allData, ...data]
        page++
        if (data.length < pageSize) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    return NextResponse.json(allData)
  } catch (err) {
    console.error('[conversations]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
