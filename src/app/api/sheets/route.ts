import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function computeScore(leadData: any): number {
  const explicit = Number(leadData?.lead_score)
  if (!isNaN(explicit) && explicit > 0) return explicit

  const stage = (leadData?.stage || '').toLowerCase()
  let score = 50
  if (['hot_customer', 'confirmed', 'completed', 'booking'].includes(stage)) {
    score = 88
  } else if (['interested', 'callback_done_by_ai'].includes(stage)) {
    score = 78
  } else if (['call_done', 'followup'].includes(stage)) {
    score = 65
  } else if (['new'].includes(stage)) {
    score = 52
  } else if (['low_budget'].includes(stage)) {
    score = 35
  } else if (['not_connected'].includes(stage)) {
    score = 25
  } else if (['not_interested', 'cancelled'].includes(stage)) {
    score = 15
  }

  const quality = (leadData?.lead_quality || '').toLowerCase()
  if (quality.includes('high') || quality.includes('hot')) score += 10
  else if (quality.includes('medium') || quality.includes('warm')) score += 5
  else if (quality.includes('low') || quality.includes('cold')) score -= 10

  if (leadData?.machine_interest && leadData.machine_interest.trim()) score += 5
  if (leadData?.callback_ready && String(leadData.callback_ready).toLowerCase() === 'yes') score += 5

  return Math.max(10, Math.min(98, score))
}

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

    const calculatedScore = computeScore(data)

    // Map database column names to match the exact keys expected by LeadPanel.tsx (which mapped from Google Sheets)
    const lead = {
      Phone: data.phone_number,
      Name: data.name || '',
      Lead_Type: data.lead_type || '',
      city: data.city || '',
      machine_interest: data.machine_interest || '',
      lead_quality: data.lead_quality || '',
      lead_score: String(calculatedScore),
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
