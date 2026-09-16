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

    const { searchParams } = new URL(req.url)
    const search       = searchParams.get('search')        || ''
    const stage        = searchParams.get('stage')         || ''
    const unread       = searchParams.get('unread')        === 'true'
    const assignedTo   = searchParams.get('assigned_to')   || ''
    const assignFilter = searchParams.get('assign_filter') || ''

    const unifiedContacts = await fetchUnifiedOsmoContacts(orgId)

    const enrichedData = unifiedContacts
      .filter(uc => uc.conversation !== null) // Chats tab only shows actual conversations
      .filter(uc => {
        const conv = uc.conversation
        if (isStaffEmployee && conv.assigned_to !== userId) return false
        if (!isStaffEmployee) {
          if (assignedTo && conv.assigned_to !== assignedTo) return false
          if (assignFilter === 'unassigned' && conv.assigned_to !== null) return false
          if (assignFilter === 'assigned' && conv.assigned_to === null) return false
          if (assignFilter && assignFilter !== 'all' && assignFilter !== 'unassigned' && assignFilter !== 'assigned' && conv.assigned_to !== assignFilter) return false
        }
        if (stage && conv.stage !== stage) return false
        if (unread && (conv.unread_count || 0) <= 0) return false
        if (search) {
          const srch = search.toLowerCase()
          const p = (uc.phone || '').toLowerCase()
          const n = (conv.name || uc.lead?.name || '').toLowerCase()
          if (!p.includes(srch) && !n.includes(srch)) return false
        }
        return true
      })
      .map(uc => {
        return {
          ...uc.conversation,
          lead: uc.lead,
          lead_type: uc.category,
          category: uc.category
        }
      })

    return NextResponse.json(enrichedData)
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error }, { status: 500 })
  }
}