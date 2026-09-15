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
    const leadType = searchParams.get('lead_type') || ''
    
    // Pagination (default to page 1, 50 items per page)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const from = (page - 1) * limit
    const to = from + limit - 1

    let leadsQuery = supabaseAdmin
      .from('leads')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(from, to)

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
    if (search) {
      leadsQuery = leadsQuery.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%,customer_name.ilike.%${search}%`)
    }
    if (leadType && leadType !== 'all') {
      if (leadType === 'unfiltered') {
        leadsQuery = leadsQuery.or('metadata->>lead_type.eq.unfiltered,metadata->>lead_type.is.null')
      } else {
        leadsQuery = leadsQuery.eq('metadata->>lead_type', leadType)
      }
    }

    const { data: allLeads, error: leadsError } = await leadsQuery
    if (leadsError) throw leadsError

    if (!allLeads || allLeads.length === 0) {
      return NextResponse.json({ data: [], hasMore: false })
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

      const lType =
        parsedMetadata.lead_type ||
        parsedMetadata.category ||
        lead.lead_type ||
        'unfiltered'

      const score = Number(parsedMetadata.lead_score ?? lead.lead_score) || 0;
      let q = (parsedMetadata.lead_quality || parsedMetadata.lead_temperature || lead.lead_temperature || 'cold').toLowerCase();
      if (score >= 70) q = 'hot';
      else if (score >= 40) q = 'warm';
      else if (score > 0) q = 'cold';

      const stg = parsedMetadata.state || parsedMetadata.stage || lead.stage || 'new';
      const displayName = lead.name || lead.customer_name || parsedMetadata.Name || parsedMetadata.name || parsedMetadata.contact_person || parsedMetadata.customer_name || 'Unknown';

      return {
        ...lead,
        ...parsedMetadata, // flatten for frontend backward compatibility
        lead_type: lType,
        name: displayName,
        stage: stg,
        lead_quality: q,
        lead_temperature: q.toUpperCase(),
        lead_score: score,
        metadata: parsedMetadata // keep nested metadata as well
      }
    })

    const hasMore = allLeads.length === limit

    return NextResponse.json({
      data: parsedLeads,
      hasMore
    })
  } catch (err: unknown) {
    console.error('[leads-list]', err)
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}
