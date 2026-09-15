import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'

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

    let leadsQuery = supabaseAdmin
      .from('leads')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (isStaffEmployee) {
      leadsQuery = leadsQuery.eq('assigned_to', userId)
    }

    if (stage) {
      leadsQuery = leadsQuery.eq('stage', stage)
    }
    if (quality) {
      leadsQuery = leadsQuery.eq('lead_quality', quality)
    }
    if (startDate) {
      leadsQuery = leadsQuery.gte('created_at', startDate)
    }
    if (endDate) {
      leadsQuery = leadsQuery.lte('created_at', `${endDate}T23:59:59.999Z`)
    }

    const convsQuery = supabaseAdmin
      .from('conversations')
      .select('id, phone_number, metadata, last_message, notes, summary')
      .eq('org_id', orgId)

    const [leadsRes, convsRes] = await Promise.all([leadsQuery, convsQuery])
    if (leadsRes.error) throw leadsRes.error

    const allLeads = leadsRes.data || []
    const convsData = convsRes.data || []

    const convMapById = new Map<string, any>()
    const convMapByPhone = new Map<string, any>()

    if (Array.isArray(convsData)) {
      convsData.forEach((c) => {
        let meta = c.metadata || {}
        if (typeof meta === 'string') {
          try { meta = JSON.parse(meta) } catch {}
        }
        // Attach conversation fields directly to the mapped object so we can use them later
        const convObj = { ...c, metadata: meta }
        if (c.id) convMapById.set(c.id, convObj)
        const cleanPhone = (c.phone_number || '').replace(/\D/g, '').slice(-10)
        if (cleanPhone) convMapByPhone.set(cleanPhone, convObj)
      })
    }

    // Safely parse metadata on each lead and flatten key fields for API consistency
    const parsedLeads = allLeads.map((lead) => {
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

      const cleanPhone = (lead.phone_number || '').replace(/\D/g, '').slice(-10)
      const matchedConv = (lead.conversation_id ? convMapById.get(lead.conversation_id) : null) ||
        (cleanPhone ? convMapByPhone.get(cleanPhone) : null) || {}

      const matchedConvMeta = matchedConv.metadata || {}

      const leadType =
        parsedMetadata.lead_type ||
        parsedMetadata.Lead_Type ||
        parsedMetadata.category ||
        lead.lead_type ||
        matchedConvMeta.lead_type ||
        matchedConvMeta.Lead_Type ||
        matchedConvMeta.category ||
        ''

      if (leadType) {
        parsedMetadata.lead_type = leadType
        parsedMetadata.category = leadType
      }
      
      // Inject conversation fields into metadata so classifyOsmoContact can use them on the frontend
      if (matchedConv.last_message) {
        parsedMetadata.last_message = matchedConv.last_message
      }
      if (matchedConv.notes) {
        parsedMetadata.notes = matchedConv.notes
      }
      if (matchedConv.summary) {
        parsedMetadata.summary = matchedConv.summary
      }

      const score = Number(parsedMetadata.lead_score ?? lead.lead_score) || 0;
      let quality = (parsedMetadata.lead_quality || parsedMetadata.lead_temperature || lead.lead_temperature || 'cold').toLowerCase();
      if (score >= 70) quality = 'hot';
      else if (score >= 40) quality = 'warm';
      else if (score > 0) quality = 'cold';

      const stage = parsedMetadata.state || parsedMetadata.stage || lead.stage || 'new';
      const displayName = lead.name || lead.customer_name || parsedMetadata.Name || parsedMetadata.name || parsedMetadata.contact_person || parsedMetadata.customer_name || 'Unknown';

      return {
        ...lead,
        ...parsedMetadata,
        lead_type: leadType,
        name: displayName,
        stage: stage,
        lead_quality: quality,
        lead_temperature: quality.toUpperCase(),
        lead_score: score,
        metadata: parsedMetadata
      }
    })

    let filteredLeads = parsedLeads

    // In-memory search for maximum flexibility (searches metadata keys and values too)
    if (search) {
      const searchLower = search.toLowerCase()
      filteredLeads = parsedLeads.filter((lead) => {
        const nameMatch = (lead.name || '').toLowerCase().includes(searchLower)
        const phoneMatch = (lead.phone_number || '').toLowerCase().includes(searchLower)
        const stageMatch = (lead.stage || '').toLowerCase().includes(searchLower)
        const qualityMatch = (lead.lead_quality || '').toLowerCase().includes(searchLower)

        let metadataMatch = false
        if (lead.metadata) {
          metadataMatch = Object.entries(lead.metadata).some(([key, val]) =>
            key.toLowerCase().includes(searchLower) ||
            String(val).toLowerCase().includes(searchLower)
          )
        }

        return nameMatch || phoneMatch || stageMatch || qualityMatch || metadataMatch
      })
    }

    return NextResponse.json(filteredLeads)
  } catch (err: unknown) {
    console.error('[leads-list]', err)
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
