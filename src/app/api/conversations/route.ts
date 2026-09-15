import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const profile = await getUserProfile(req)
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, orgId, role } = profile
    const isStaffEmployee = role !== 'owner' && role !== 'admin'

    const { searchParams } = new URL(req.url)
    const search       = searchParams.get('search')        || ''
    const stage        = searchParams.get('stage')         || ''
    const unread       = searchParams.get('unread')        === 'true'
    const assignedTo   = searchParams.get('assigned_to')   || ''
    const assignFilter = searchParams.get('assign_filter') || ''

    let query = supabaseAdmin
      .from('conversations')
      .select('*, lead:leads(*)')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })

    if (isStaffEmployee) {
      // Non-admin employee is strictly restricted to conversations assigned to them
      query = query.eq('assigned_to', userId)
    } else {
      if (assignedTo) query = query.eq('assigned_to', assignedTo)
      if (assignFilter === 'unassigned') query = query.is('assigned_to', null)
      else if (assignFilter === 'assigned') query = query.not('assigned_to', 'is', null)
      else if (assignFilter && assignFilter !== 'all') query = query.eq('assigned_to', assignFilter)
    }

    if (search) query = query.or(`phone_number.ilike.%${search}%,name.ilike.%${search}%`)
    if (stage)  query = query.eq('stage', stage)
    if (unread) query = query.gt('unread_count', 0)

    const leadsQuery = supabaseAdmin
      .from('leads')
      .select('id, conversation_id, phone_number, name, lead_type, stage, lead_quality, lead_score, lead_temperature, metadata')
      .eq('org_id', orgId)

    const [convRes, leadsRes] = await Promise.all([query, leadsQuery])
    if (convRes.error) throw convRes.error

    const data = convRes.data || []
    const leadsData = leadsRes.data || []

    const leadsByConvId = new Map<string, any>()
    const leadsByPhone = new Map<string, any>()

    if (Array.isArray(leadsData)) {
      leadsData.forEach((l) => {
        if (l.conversation_id) leadsByConvId.set(l.conversation_id, l)
        const cleanPhone = (l.phone_number || '').replace(/\D/g, '').slice(-10)
        if (cleanPhone) leadsByPhone.set(cleanPhone, l)
      })
    }

    const enrichedData = (data || []).map((conv: any) => {
      let matchedLead = conv.lead
      if (Array.isArray(matchedLead)) {
        matchedLead = matchedLead[0] || null
      }
      if (!matchedLead && conv.id) {
        matchedLead = leadsByConvId.get(conv.id) || null
      }
      if (!matchedLead && conv.phone_number) {
        const cleanPhone = (conv.phone_number || '').replace(/\D/g, '').slice(-10)
        matchedLead = leadsByPhone.get(cleanPhone) || null
      }

      let parsedMeta = conv.metadata || {}
      if (typeof parsedMeta === 'string') {
        try { parsedMeta = JSON.parse(parsedMeta) } catch {}
      }

      let leadMeta = matchedLead?.metadata || {}
      if (typeof leadMeta === 'string') {
        try { leadMeta = JSON.parse(leadMeta) } catch {}
      }

      const leadType =
        conv.lead_type ||
        parsedMeta.lead_type ||
        parsedMeta.Lead_Type ||
        parsedMeta.category ||
        parsedMeta.user_type ||
        matchedLead?.lead_type ||
        matchedLead?.Lead_Type ||
        leadMeta.lead_type ||
        leadMeta.Lead_Type ||
        leadMeta.category ||
        leadMeta.type ||
        leadMeta.user_type ||
        leadMeta.customer_type ||
        ''

      if (leadType) {
        parsedMeta.lead_type = leadType
        parsedMeta.category = leadType
        leadMeta.lead_type = leadType
        leadMeta.category = leadType
      }

      return {
        ...conv,
        metadata: parsedMeta,
        lead: matchedLead ? { ...matchedLead, metadata: leadMeta, lead_type: leadType } : (conv.lead ? { ...(Array.isArray(conv.lead) ? conv.lead[0] : conv.lead), metadata: leadMeta, lead_type: leadType } : null),
        lead_type: leadType,
      }
    })

    return NextResponse.json(enrichedData)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}