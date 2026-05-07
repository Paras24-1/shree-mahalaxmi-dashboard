import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')
    const stage = searchParams.get('stage')
    const unread = searchParams.get('unread') === 'true'
    const assignedFilter = searchParams.get('assignedFilter') || 'all'

    // Get current user
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let userId = null
    let userRole = null
    
    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      if (user) {
        userId = user.id
        const { data: profile } = await supabaseAdmin
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()
        userRole = profile?.role
      }
    }

    let query = supabaseAdmin
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })

    // Employee sees only their assigned chats
    if (userRole === 'employee' && userId) {
      query = query.eq('assigned_to', userId)
    }

    // Admin filters
    if (userRole === 'admin') {
      if (assignedFilter === 'unassigned') {
        query = query.is('assigned_to', null)
      } else if (assignedFilter === 'assigned') {
        query = query.not('assigned_to', 'is', null)
      }
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%`)
    }
    if (stage) {
      query = query.eq('stage', stage)
    }
    if (unread) {
      query = query.gt('unread_count', 0)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json(data || [])

  } catch (err) {
    console.error('[conversations]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
