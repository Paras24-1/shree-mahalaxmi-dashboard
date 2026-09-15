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

    const buildQuery = (leadType?: string) => {
      let q = supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
      
      if (isStaffEmployee) q = q.eq('assigned_to', userId)
      if (stage) q = q.eq('stage', stage)
      if (quality) q = q.eq('lead_quality', quality)
      if (startDate) q = q.gte('created_at', startDate)
      if (endDate) q = q.lte('created_at', `${endDate}T23:59:59.999Z`)
      if (search) q = q.or(`name.ilike.%${search}%,phone_number.ilike.%${search}%,customer_name.ilike.%${search}%`)
      if (leadType) {
        // Fallback for null/missing lead_type mapping to unfiltered
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
