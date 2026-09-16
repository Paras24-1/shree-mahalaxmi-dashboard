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

    const isOsmo = await isOsmoOrg(orgId)

    if (isOsmo) {
      // 1. Fetch all leads for org with pagination
      let allLeads: any[] = []
      let fromLead = 0
      while (true) {
        let q = supabaseAdmin
          .from('leads')
          .select('id, conversation_id, phone_number, name, customer_name, stage, lead_quality, lead_temperature, metadata, assigned_to, created_at')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })

        if (isStaffEmployee) q = q.eq('assigned_to', userId)
        if (stage) q = q.eq('stage', stage)
        if (quality) q = q.eq('lead_quality', quality)
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

      // 2. Fetch conversations to enrich notes and last_message
      let allConvs: any[] = []
      let fromConv = 0
      while (true) {
        const { data, error } = await supabaseAdmin
          .from('conversations')
          .select('id, phone_number, name, last_message, notes')
          .eq('org_id', orgId)
          .range(fromConv, fromConv + 999)
        if (error) break
        if (!data || data.length === 0) break
        allConvs.push(...data)
        if (data.length < 1000) break
        fromConv += 1000
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

      const stats = {
        total: allLeads.length,
        osmo_dealer: 0,
        dealer: 0,
        customer: 0,
        unfiltered: 0
      }

      allLeads.forEach(l => {
        const p = (l.phone_number || '').replace(/\D/g, '').slice(-10)
        const matchedConv = (l.conversation_id ? convsById.get(l.conversation_id) : null) || (p ? convsByPhone.get(p) : null)
        const combined = {
          ...l,
          lead: l,
          notes: matchedConv?.notes || l.notes || l.followup_notes,
          last_message: matchedConv?.last_message
        }
        const category = classifyOsmoContact(combined)
        if (category in stats) {
          stats[category]++
        } else {
          stats.unfiltered++
        }
      })

      return NextResponse.json(stats)
    }

    // Default query for non-osmo orgs
    const buildQuery = (leadType?: string) => {
      let q = supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      
      if (isStaffEmployee) q = q.eq('assigned_to', userId)
      if (stage) q = q.eq('stage', stage)
      if (quality) q = q.eq('lead_quality', quality)
      if (startDate) q = q.gte('created_at', startDate)
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (search) q = q.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%,customer_name.ilike.%${search}%`)
      if (leadType) {
        if (leadType === 'unfiltered') {
           q = q.or('metadata->>lead_type.eq.unfiltered,metadata->>lead_type.is.null')
        } else {
           q = q.eq('metadata->>lead_type', leadType)
        }
      }
      return q
    }

    const [totalRes, osmoRes, dealerRes, customerRes, unfiltRes] = await Promise.all([
      buildQuery(),
      buildQuery('osmo_dealer'),
      buildQuery('dealer'),
      buildQuery('customer'),
      buildQuery('unfiltered')
    ])

    if (totalRes.error) throw totalRes.error

    return NextResponse.json({
      total: totalRes.count || 0,
      osmo_dealer: osmoRes.count || 0,
      dealer: dealerRes.count || 0,
      customer: customerRes.count || 0,
      unfiltered: unfiltRes.count || 0
    })
  } catch (err: unknown) {
    console.error('[leads-stats]', err)
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}

