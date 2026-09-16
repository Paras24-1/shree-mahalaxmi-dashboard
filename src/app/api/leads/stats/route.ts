import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, getUserProfile } from '@/lib/supabase'
import { fetchUnifiedOsmoContacts } from '@/lib/osmoPhonebooks'

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

    const unifiedContacts = await fetchUnifiedOsmoContacts(orgId)

    const stats: Record<string, number> = {
      total: 0,
      osmo_dealer: 0,
      dealer: 0,
      customer: 0,
      unfiltered: 0,
      hot: 0,
      warm: 0,
      followups: 0
    }

    unifiedContacts.forEach(uc => {
      if (isStaffEmployee && uc.conversation?.assigned_to !== userId) {
        return
      }

      const l = uc.lead || {}
      const c = uc.conversation || {}
      
      let parsedMeta: Record<string, any> = l.metadata || {}

      const leadStage = c.stage || l.stage || parsedMeta.state || parsedMeta.stage || 'new'
      if (leadStage === 'followup' || !!l.followup_date) stats.followups++
      if (stage && leadStage !== stage) return

      const score = Number(parsedMeta.lead_score ?? 0)
      let q = (parsedMeta.lead_quality || parsedMeta.lead_temperature || l.lead_temperature || 'cold').toLowerCase()
      if (score >= 70) q = 'hot'
      else if (score >= 40) q = 'warm'
      else if (score > 0) q = 'cold'

      if (q === 'hot') stats.hot++
      if (q === 'warm') stats.warm++
      if (quality && q !== quality.toLowerCase()) return

      if (startDate || endDate) {
        const createdAt = l.created_at || c.created_at
        if (!createdAt) return
        const dt = new Date(createdAt).getTime()
        if (startDate && dt < new Date(startDate).getTime()) return
        if (endDate && dt > new Date(`${endDate}T23:59:59.999Z`).getTime()) return
      }

      if (search) {
        const srch = search.toLowerCase()
        const n = (l.name || c.name || '').toLowerCase()
        const p = (uc.phone || '').toLowerCase()
        const cst = (l.customer_name || '').toLowerCase()
        if (!n.includes(srch) && !p.includes(srch) && !cst.includes(srch)) return
      }

      const category = uc.category
      stats.total++
      if (category in stats) {
        stats[category]++
      } else {
        stats.unfiltered++
      }
    })

    return NextResponse.json(stats)
  } catch (err: unknown) {
    console.error('[leads-stats]', err)
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}



