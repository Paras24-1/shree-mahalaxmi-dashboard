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
    const assignFilter = searchParams.get('assign_filter') || ''
    const limitParam = searchParams.get('limit')

    const isAll = searchParams.get('all') === 'true' || limitParam === 'all'
    const hasSpecificLimit = limitParam && !isNaN(Number(limitParam))
    const maxLimit = isAll ? Infinity : (hasSpecificLimit ? Number(limitParam) : 300)

    let allConversations: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const from = page * pageSize
      const to = isAll
        ? (page + 1) * pageSize - 1
        : Math.min((page + 1) * pageSize - 1, maxLimit - 1)

      let pageQuery = supabaseAdmin
        .from('conversations')
        .select('id, name, phone_number, last_message, unread_count, stage, assigned_to, updated_at, created_at, ai_mode')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .range(from, to)

      // Admin / user explicit assignment filter tabs
      if (assignFilter === 'unassigned') {
        pageQuery = pageQuery.is('assigned_to', null)
      } else if (assignFilter === 'assigned') {
        pageQuery = pageQuery.not('assigned_to', 'is', null)
      } else if (assignFilter && assignFilter !== 'all') {
        pageQuery = pageQuery.eq('assigned_to', assignFilter)
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

      if (data && data.length > 0) {
        allConversations = [...allConversations, ...data]
        page++
        if (data.length < pageSize || allConversations.length >= maxLimit) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    return NextResponse.json(allConversations, {
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
