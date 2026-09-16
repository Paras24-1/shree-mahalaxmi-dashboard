import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'
import { classifyOsmoContact } from '@/lib/osmoPhonebooks'

export const dynamic = 'force-dynamic'

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

    // Fetch all conversations with pagination to avoid 1000 row cap
    let allConvs: any[] = []
    let fromConv = 0
    while (true) {
      const { data, error } = await query.range(fromConv, fromConv + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      allConvs.push(...data)
      if (data.length < 1000) break
      fromConv += 1000
    }

    // Fetch all leads for this org with valid columns to ensure lead matching
    let allLeads: any[] = []
    let fromLead = 0
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('id, conversation_id, phone_number, name, customer_name, lead_temperature, metadata')
        .eq('org_id', orgId)
        .range(fromLead, fromLead + 999)
      if (error) break
      if (!data || data.length === 0) break
      allLeads.push(...data)
      if (data.length < 1000) break
      fromLead += 1000
    }

    const data = allConvs
    const leadsData = allLeads

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

      // Compute unified derived category using classifyOsmoContact
      const derivedType = classifyOsmoContact({
        ...conv,
        lead: matchedLead
      })

      parsedMeta.lead_type = derivedType
      parsedMeta.category = derivedType
      leadMeta.lead_type = derivedType
      leadMeta.category = derivedType

      return {
        ...conv,
        metadata: parsedMeta,
        lead: matchedLead ? { ...matchedLead, metadata: leadMeta, lead_type: derivedType, category: derivedType } : null,
        lead_type: derivedType,
        category: derivedType
      }
    })

    return NextResponse.json(enrichedData)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}