import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search') || ''

    // 1. Fetch from customers table
    let query = supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      if (status === 'favorite') {
        query = query.or('status.eq.favorite,is_favorite.eq.true')
      } else {
        query = query.eq('status', status)
      }
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%,city.ilike.%${search}%`)
    }

    const { data: customerData, error: customerError } = await query

    if (customerError) {
      console.warn('Could not query customers table, falling back to leads/conversations:', customerError.message)
      // Fallback to conversations if customers table not yet created
      const { data: convData } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .order('updated_at', { ascending: false })

      const mapped = (convData || []).map((c: any) => ({
        id: c.id,
        name: c.name || 'Unknown Client',
        phone_number: c.phone_number,
        city: 'Mumbai',
        status: 'active',
        is_favorite: false,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }))
      return NextResponse.json(mapped)
    }

    // Also if customer table is empty, seed/display initial leads/conversations gracefully
    if ((!customerData || customerData.length === 0) && !status && !search) {
      const { data: convData } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .limit(20)

      if (convData && convData.length > 0) {
        const mapped = convData.map((c: any) => ({
          id: c.id,
          name: c.name && c.name !== 'Unknown' ? c.name : `Client (${c.phone_number.slice(-4)})`,
          phone_number: c.phone_number,
          city: 'Mumbai',
          status: 'active',
          is_favorite: false,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }))
        return NextResponse.json(mapped)
      }
    }

    return NextResponse.json(customerData || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, phone_number, email, city, company, machine_interest, status, notes } = body

    if (!name || !phone_number) {
      return NextResponse.json({ error: 'Name and Phone Number are required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert({
        name: name.trim(),
        phone_number: phone_number.trim(),
        email: email?.trim() || null,
        city: city?.trim() || null,
        company: company?.trim() || null,
        machine_interest: machine_interest?.trim() || null,
        status: status || 'active',
        is_favorite: status === 'favorite',
        notes: notes?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
