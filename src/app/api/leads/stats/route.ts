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

    // 1. Fetch conversations for org to get assigned_to, stage, notes, and last_message
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

    const stats = {
      total: 0,
      osmo_dealer: 0,
      dealer: 0,
      customer: 0,
      unfiltered: 0
    }

    allLeads.forEach(l => {
      const p = (l.phone_number || '').replace(/\D/g, '').slice(-10)
      if (isStaffEmployee) {
        const isAssigned = (l.conversation_id && assignedConvIds.has(l.conversation_id)) || (p && assignedPhones.has(p))
        if (!isAssigned) return
      }

      const matchedConv = (l.conversation_id ? convsById.get(l.conversation_id) : null) || (p ? convsByPhone.get(p) : null)
      
      let parsedMeta: Record<string, any> = {}
      if (l.metadata) {
        if (typeof l.metadata === 'string') {
          try { parsedMeta = JSON.parse(l.metadata) } catch {}
        } else if (typeof l.metadata === 'object') {
          parsedMeta = l.metadata
        }
      }

      const leadStage = matchedConv?.stage || parsedMeta.state || parsedMeta.stage || 'new'
      if (stage && leadStage !== stage) return

      const score = Number(parsedMeta.lead_score ?? 0)
      let q = (parsedMeta.lead_quality || parsedMeta.lead_temperature || l.lead_temperature || 'cold').toLowerCase()
      if (score >= 70) q = 'hot'
      else if (score >= 40) q = 'warm'
      else if (score > 0) q = 'cold'
      if (quality && q !== quality.toLowerCase()) return

      const combined = {
        ...l,
        lead: l,
        notes: matchedConv?.notes || l.notes || l.followup_notes,
        last_message: matchedConv?.last_message
      }

      const category = classifyOsmoContact(combined)
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


