import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')

  if (!phone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  // Fetch call logs matching this lead's phone number as caller or recipient
  const { data, error } = await supabaseAdmin
    .from('call_logs')
    .select('id, duration_seconds, status, transcript, created_at')
    .or(`from_phone_number.eq.${phone},to_phone_number.ilike.%${phone}%`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Call Transcripts API] Error fetching logs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
