import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')

  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  // Clean phone number: keep only digits
  const cleanPhone = phone.replace(/\D/g, '')
  if (!cleanPhone) {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
  }

  // Extract the last 10 digits to match prefix-agnostically (handles country codes, + sign, etc.)
  const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone

  // Fetch call logs matching this lead's phone number as caller or recipient using prefix-agnostic search
  const { data, error } = await supabaseAdmin
    .from('call_logs')
    .select('id, duration_seconds, status, transcript, created_at')
    .or(`from_phone_number.ilike.%${last10}%,to_phone_number.ilike.%${last10}%`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Call Transcripts API] Error fetching logs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
