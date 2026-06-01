import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const rawPhone = searchParams.get('phone') || ''
    const phone = rawPhone.replace(/\D/g, '').slice(-10)

    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 })
    }

    // Query leads table matching the last 10 digits of phone_number
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .ilike('phone_number', `%${phone}`)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return NextResponse.json({ error: 'No matching lead found' }, { status: 404 })
    }

    // Map database column names to match the exact keys expected by LeadPanel.tsx (which mapped from Google Sheets)
    const lead = {
      Phone: data.phone_number,
      Name: data.name || '',
      Lead_Type: data.lead_type || '',
      city: data.city || '',
      machine_interest: data.machine_interest || '',
      lead_quality: data.lead_quality || '',
      lead_score: String(data.lead_score || 0),
      callback_ready: data.callback_ready || '',
      conversation_summary: data.conversation_summary || '',
      followup_date: data.followup_date || null,
      followup_notes: data.followup_notes || null,
      followup_notified: data.followup_notified || false,
      stage: data.stage || 'new',
      ...(data.metadata || {}) // Dynamically unpack all custom columns (e.g. Tehsil, Crop_Requirement)
    }

    return NextResponse.json(lead)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
