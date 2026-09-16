import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'
import { classifyOsmoContact, isOsmoOrg } from '@/lib/osmoPhonebooks'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const profile = await getUserProfile(req)
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, orgId, role } = profile
    const isStaffEmployee = role !== 'owner' && role !== 'admin'

    const searchParams = new URL(req.url).searchParams
    const stage = searchParams.get('stage') || ''
    const quality = searchParams.get('quality') || ''
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('start_date') || ''
    const endDate = searchParams.get('end_date') || ''
    const leadType = searchParams.get('lead_type') || ''
    const geographicState = searchParams.get('state') || ''
    
    // Pagination (default to page 1, 50 items per page)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const from = (page - 1) * limit

    // 1. Fetch conversations for org
    let allConvs: any[] = []
    let fromConv = 0
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('id, phone_number, name, stage, last_message, notes, assigned_to')
        .eq('org_id', orgId)
        .range(fromConv, fromConv + 999)
      if (error) break
      if (!data || data.length === 0) break
      allConvs.push(...data)
      if (data.length < 1000) break
      fromConv += 1000
    }

    const assignedConvIds = new Set<string>()
    const assignedPhones = new Set<string>()
    if (isStaffEmployee) {
      allConvs.forEach(c => {
        if (c.assigned_to === userId) {
          if (c.id) assignedConvIds.add(c.id)
          const p = (c.phone_number || '').replace(/\D/g, '').slice(-10)
          if (p) assignedPhones.add(p)
        }
      })
    }

    // 2. Fetch all leads for org with pagination
    let allLeads: any[] = []
    let fromLead = 0
    while (true) {
      let q = supabaseAdmin
        .from('leads')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

      if (startDate) q = q.gte('created_at', startDate)
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (search) q = q.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%,customer_name.ilike.%${search}%`)

      const { data, error } = await q.range(fromLead, fromLead + 999)
      if (error) throw error
      if (!data || data.length === 0) break
      allLeads.push(...data)
      if (data.length < 1000) break
      fromLead += 1000
    }

    const convsByPhone = new Map<string, any>()
    const convsById = new Map<string, any>()
    allConvs.forEach(c => {
      if (c.id) convsById.set(c.id, c)
      if (c.phone_number) {
        const p = (c.phone_number || '').replace(/\D/g, '').slice(-10)
        if (p) convsByPhone.set(p, c)
      }
    })

    // 3. Process each lead, derive classification, and parse metadata
    const enrichedLeads = allLeads.map((lead) => {
      let parsedMetadata: Record<string, any> = {}
      if (lead.metadata) {
        if (typeof lead.metadata === 'string') {
          try {
            parsedMetadata = JSON.parse(lead.metadata)
          } catch {}
        } else if (typeof lead.metadata === 'object') {
          parsedMetadata = lead.metadata
        }
      }

      const p = (lead.phone_number || '').replace(/\D/g, '').slice(-10)
      const matchedConv = (lead.conversation_id ? convsById.get(lead.conversation_id) : null) || (p ? convsByPhone.get(p) : null)
      const combined = {
        ...lead,
        lead: lead,
        notes: matchedConv?.notes || lead.notes || lead.followup_notes,
        last_message: matchedConv?.last_message
      }

      const derivedType = classifyOsmoContact(combined)

      const score = Number(parsedMetadata.lead_score ?? 0)
      let q = (parsedMetadata.lead_quality || parsedMetadata.lead_temperature || lead.lead_temperature || 'cold').toLowerCase()
      if (score >= 70) q = 'hot'
      else if (score >= 40) q = 'warm'
      else if (score > 0) q = 'cold'

      const stg = matchedConv?.stage || parsedMetadata.state || parsedMetadata.stage || 'new'
      const displayName = lead.name || lead.customer_name || parsedMetadata.Name || parsedMetadata.name || parsedMetadata.contact_person || parsedMetadata.customer_name || 'Unknown'

      return {
        ...lead,
        ...parsedMetadata,
        lead_type: derivedType,
        name: displayName,
        stage: stg,
        lead_quality: q,
        lead_temperature: q.toUpperCase(),
        lead_score: score,
        metadata: { ...parsedMetadata, lead_type: derivedType, category: derivedType },
        _isAssignedToStaff: !isStaffEmployee || (lead.conversation_id && assignedConvIds.has(lead.conversation_id)) || (p && assignedPhones.has(p))
      }
    })

    // 4. Apply filters (staff assignment, stage, quality, leadType)
    const filteredLeads = enrichedLeads.filter(l => {
      if (isStaffEmployee && !l._isAssignedToStaff) return false
      if (stage && l.stage !== stage) return false
      if (quality && l.lead_quality !== quality.toLowerCase()) return false
      if (leadType && leadType !== 'all') {
        if (l.lead_type !== leadType) return false
      }
      if (geographicState && l.state !== geographicState) return false
      return true
    })

    const slicedLeads = filteredLeads.slice(from, from + limit)
    const hasMore = (from + limit) < filteredLeads.length

    return NextResponse.json({
      data: slicedLeads,
      hasMore
    })
  } catch (err: unknown) {
    console.error('[leads-list]', err)
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}


