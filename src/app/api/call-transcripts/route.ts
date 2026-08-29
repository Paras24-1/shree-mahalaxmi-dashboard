import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin as defaultSupabaseAdmin } from '@/lib/supabase'

// Initialize a dedicated client for Voice SaaS database if configured in environment variables
const voiceSaasSupabaseUrl = process.env.VOICE_SAAS_SUPABASE_URL
const voiceSaasSupabaseServiceKey = process.env.VOICE_SAAS_SUPABASE_SERVICE_ROLE_KEY

const queryClient = (voiceSaasSupabaseUrl && voiceSaasSupabaseServiceKey)
  ? createClient(voiceSaasSupabaseUrl, voiceSaasSupabaseServiceKey)
  : defaultSupabaseAdmin

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
  const { data, error } = await queryClient
    .from('call_logs')
    .select('id, duration_seconds, status, transcript, created_at, recording_url')
    .or(`from_phone_number.ilike.%${last10}%,to_phone_number.ilike.%${last10}%`)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[Call Transcripts API] Error fetching logs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

// POST /api/call-transcripts: Ingest call transcript, status, and recording URL directly from webhooks/n8n
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      phone_number,
      phoneNumber,
      to_phone_number,
      from_phone_number,
      phone,
      transcript,
      recording_url,
      recordingUrl,
      duration_seconds,
      duration,
      status,
      call_id,
      id,
    } = body

    const targetPhone = phone_number || phoneNumber || to_phone_number || from_phone_number || phone
    const recording = recording_url || recordingUrl || null
    const callStatus = status || 'completed'
    const dur = Number(duration_seconds || duration || 0)

    if (!targetPhone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const cleanPhone = String(targetPhone).replace(/\D/g, '')
    const canonicalPhone = cleanPhone.length === 10 ? `+91${cleanPhone}` : (cleanPhone.startsWith('91') && cleanPhone.length === 12 ? `+${cleanPhone}` : targetPhone)

    const logData = {
      ...(id || call_id ? { id: id || call_id } : {}),
      to_phone_number: canonicalPhone,
      from_phone_number: from_phone_number || 'Voice AI',
      transcript: transcript || '',
      recording_url: recording,
      duration_seconds: dur,
      status: callStatus,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await queryClient
      .from('call_logs')
      .upsert(logData)
      .select()
      .single()

    if (error) {
      console.error('[Call Transcripts POST Error]:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Call transcript and recording logged successfully',
      data,
    })
  } catch (err: any) {
    console.error('[Call Transcripts POST Exception]:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
