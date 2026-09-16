import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'
import { classifyOsmoContact, fetchUnifiedOsmoContacts } from '@/lib/osmoPhonebooks'

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

    const unifiedContacts = await fetchUnifiedOsmoContacts(orgId)

    // Apply staff restriction first
    let allowedContacts = unifiedContacts
    if (isStaffEmployee) {
      allowedContacts = unifiedContacts.filter(uc => {
        return uc.conversation?.assigned_to === userId
      })
    }

    // 3. Process each lead, derive classification, and parse metadata
    const enrichedLeads = allowedContacts.map((uc) => {
      const l = uc.lead || {}
      const c = uc.conversation || {}
      const p = uc.phone

      let parsedMetadata: Record<string, any> = l.metadata || {}
      
      const score = Number(parsedMetadata.lead_score ?? 0)
      let q = (parsedMetadata.lead_quality || parsedMetadata.lead_temperature || l.lead_temperature || 'cold').toLowerCase()
      if (score >= 70) q = 'hot'
      else if (score >= 40) q = 'warm'
      else if (score > 0) q = 'cold'

      const stg = c.stage || l.stage || parsedMetadata.state || parsedMetadata.stage || 'new'
      const displayName = c.name || l.name || l.customer_name || parsedMetadata.Name || parsedMetadata.name || parsedMetadata.contact_person || parsedMetadata.customer_name || 'Unknown'

      // Keep original created_at if it's from lead, else conversation
      const createdAt = l.created_at || c.created_at
      
      return {
        ...l,
        ...parsedMetadata,
        id: l.id || c.id || p,
        phone_number: p,
        created_at: createdAt,
        lead_type: uc.category,
        name: displayName,
        stage: stg,
        lead_quality: q,
        lead_temperature: q.toUpperCase(),
        lead_score: score,
        metadata: { ...parsedMetadata, lead_type: uc.category, category: uc.category }
      }
    })

    // 4. Apply filters (stage, quality, leadType, state, date, search)
    const filteredLeads = enrichedLeads.filter(l => {
      if (stage && l.stage !== stage) return false
      if (quality && l.lead_quality !== quality.toLowerCase()) return false
      if (leadType && leadType !== 'all') {
        if (l.lead_type !== leadType) return false
      }
      if (geographicState && l.state !== geographicState) return false
      
      if (startDate || endDate) {
        if (!l.created_at) return false
        const dt = new Date(l.created_at).getTime()
        if (startDate && dt < new Date(startDate).getTime()) return false
        if (endDate && dt > new Date(`${endDate}T23:59:59.999Z`).getTime()) return false
      }
      
      if (search) {
        const srch = search.toLowerCase()
        const n = (l.name || '').toLowerCase()
        const p = (l.phone_number || '').toLowerCase()
        const cst = (l.customer_name || '').toLowerCase()
        if (!n.includes(srch) && !p.includes(srch) && !cst.includes(srch)) return false
      }
      
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


