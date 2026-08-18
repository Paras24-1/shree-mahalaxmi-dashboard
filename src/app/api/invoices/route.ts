import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const isQuotation = searchParams.get('is_quotation') === 'true'
    const search = searchParams.get('search') || ''
    const fromDate = searchParams.get('from_date')
    const toDate = searchParams.get('to_date')

    let query = supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('is_quotation', isQuotation)
      .order('created_at', { ascending: false })

    if (status && status !== 'all' && status !== 'ALL') {
      query = query.eq('status', status.toLowerCase())
    }

    if (search) {
      query = query.or(`invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`)
    }

    if (fromDate) {
      query = query.gte('issue_date', fromDate)
    }
    if (toDate) {
      query = query.lte('issue_date', toDate)
    }

    const { data, error } = await query
    if (error) {
      console.warn('Invoices table query failed or not created yet:', error.message)
      return NextResponse.json([])
    }

    return NextResponse.json(data || [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      invoice_number,
      customer_name,
      customer_phone,
      customer_email,
      issue_date,
      due_date,
      subtotal,
      tax_rate,
      tax_amount,
      discount,
      total_amount,
      paid_amount,
      status,
      items,
      notes,
      is_quotation,
    } = body

    if (!customer_name) {
      return NextResponse.json({ error: 'Customer Name is required' }, { status: 400 })
    }

    const invNum = invoice_number || (is_quotation ? `QUO-${Date.now().toString().slice(-6)}` : `INV-${Date.now().toString().slice(-6)}`)

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert({
        invoice_number: invNum,
        customer_name: customer_name.trim(),
        customer_phone: customer_phone?.trim() || null,
        customer_email: customer_email?.trim() || null,
        issue_date: issue_date || new Date().toISOString().split('T')[0],
        due_date: due_date || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        subtotal: Number(subtotal) || 0,
        tax_rate: Number(tax_rate) || 18,
        tax_amount: Number(tax_amount) || 0,
        discount: Number(discount) || 0,
        total_amount: Number(total_amount) || 0,
        paid_amount: Number(paid_amount) || 0,
        status: status || 'unpaid',
        items: items || [],
        notes: notes?.trim() || null,
        is_quotation: !!is_quotation,
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
      .from('invoices')
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

    const { error } = await supabaseAdmin.from('invoices').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
