import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin as defaultSupabaseAdmin } from '@/lib/supabase'

// Initialize client for Voice SaaS database
const voiceSaasSupabaseUrl = process.env.VOICE_SAAS_SUPABASE_URL
const voiceSaasSupabaseServiceKey = process.env.VOICE_SAAS_SUPABASE_SERVICE_ROLE_KEY

const queryClient = (voiceSaasSupabaseUrl && voiceSaasSupabaseServiceKey)
  ? createClient(voiceSaasSupabaseUrl, voiceSaasSupabaseServiceKey)
  : defaultSupabaseAdmin

let cachedPhoneMap: Map<string, string> | null = null
let cachedPhoneMapExpiry = 0

async function getPhoneToEmployeeMap(): Promise<Map<string, string>> {
  const now = Date.now()
  if (cachedPhoneMap && now < cachedPhoneMapExpiry) {
    return cachedPhoneMap
  }

  let conversations: any[] = []
  let pageConv = 0
  const pageSize = 1000
  let hasMoreConv = true

  while (hasMoreConv) {
    const { data, error } = await defaultSupabaseAdmin
      .from('conversations')
      .select('phone_number, assigned_to')
      .not('assigned_to', 'is', null)
      .range(pageConv * pageSize, (pageConv + 1) * pageSize - 1)

    if (error) break
    if (data && data.length > 0) {
      conversations = [...conversations, ...data]
      pageConv++
      if (data.length < pageSize) {
        hasMoreConv = false
      }
    } else {
      hasMoreConv = false
    }
  }

  const phoneMap = new Map<string, string>()
  for (const c of conversations) {
    if (c.phone_number && c.assigned_to) {
      const clean = c.phone_number.replace(/\D/g, '')
      if (clean) {
        phoneMap.set(clean.slice(-10), c.assigned_to)
      }
    }
  }

  cachedPhoneMap = phoneMap
  cachedPhoneMapExpiry = now + 60_000 // 60s cache
  return phoneMap
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const timeRange = searchParams.get('timeRange') || 'all'

  // Determine date boundaries
  let dateFilter = new Date()
  let hasFilter = false

  if (timeRange === 'today') {
    dateFilter.setHours(0, 0, 0, 0)
    hasFilter = true
  } else if (timeRange === 'weekly') {
    dateFilter.setDate(dateFilter.getDate() - 7)
    hasFilter = true
  } else if (timeRange === 'monthly') {
    dateFilter.setDate(dateFilter.getDate() - 30)
    hasFilter = true
  }

  try {
    const voiceOrgId = process.env.VOICE_SAAS_ORGANIZATION_ID || '9bc1c153-e617-444a-81e1-f3951d4b386b'

    // Build call logs query
    let logsQuery = queryClient
      .from('call_logs')
      .select('id, from_phone_number, to_phone_number, duration_seconds, status, created_at, recording_url')
      .eq('organization_id', voiceOrgId)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (hasFilter) {
      logsQuery = logsQuery.gte('created_at', dateFilter.toISOString())
    }

    // Run queries in parallel
    const [phoneToEmployeeMap, { data: callLogs, error: logsError }, { data: employees, error: empError }] = await Promise.all([
      getPhoneToEmployeeMap(),
      logsQuery,
      defaultSupabaseAdmin.from('users').select('id, name, email').eq('role', 'employee'),
    ])

    if (logsError) throw logsError
    if (empError) throw empError

    // Initialize stats map for employees
    const employeeStatsMap = new Map<string, {
      outgoing: number
      incoming: number
      missed: number
      total: number
      picked: number
      notPicked: number
      missedBreakdown: { busy: number, 'no-answer': number, failed: number }
    }>()

    const employeeMap = new Map<string, { name: string, email: string }>()
    if (employees) {
      for (const emp of employees) {
        employeeMap.set(emp.id, { name: emp.name, email: emp.email })
        employeeStatsMap.set(emp.id, {
          outgoing: 0,
          incoming: 0,
          missed: 0,
          total: 0,
          picked: 0,
          notPicked: 0,
          missedBreakdown: { busy: 0, 'no-answer': 0, failed: 0 }
        })
      }
    }

    const unassignedKey = 'unassigned'
    employeeStatsMap.set(unassignedKey, {
      outgoing: 0,
      incoming: 0,
      missed: 0,
      total: 0,
      picked: 0,
      notPicked: 0,
      missedBreakdown: { busy: 0, 'no-answer': 0, failed: 0 }
    })

    const callLogsList: any[] = []

    const trunkNumbers = ['8071583314', '918071583314']
    const isSystemOrTrunk = (val: string | null | undefined, cleanVal: string) => {
      if (!val) return true
      const lower = val.toLowerCase()
      if (
        lower.includes('campaign') ||
        lower.includes('outbound') ||
        lower.includes('xml') ||
        lower.includes('vobiz') ||
        lower.includes('agent') ||
        lower.includes('widget') ||
        lower.includes('yash') ||
        lower.includes('triman') ||
        lower.includes('osmo') ||
        lower.includes('noida')
      ) {
        return true
      }
      if (trunkNumbers.includes(cleanVal)) {
        return true
      }
      return false
    }

    // Loop through call logs and aggregate statistics
    if (callLogs) {
      for (const log of callLogs) {
        let customerPhone = ''
        let direction: 'incoming' | 'outgoing' = 'outgoing'

        const fromClean = log.from_phone_number ? log.from_phone_number.replace(/\D/g, '') : ''
        const toClean = log.to_phone_number ? log.to_phone_number.replace(/\D/g, '') : ''

        const fromIsSystem = isSystemOrTrunk(log.from_phone_number, fromClean)
        const toIsSystem = isSystemOrTrunk(log.to_phone_number, toClean)

        if (fromIsSystem && !toIsSystem) {
          // Outbound call from system to customer
          customerPhone = toClean
          direction = 'outgoing'
        } else if (!fromIsSystem && toIsSystem) {
          // Inbound call from customer to system
          customerPhone = fromClean
          direction = 'incoming'
        } else if (!fromIsSystem && !toIsSystem) {
          // Fallback if neither is explicitly system, check if from is trunk
          if (trunkNumbers.includes(fromClean)) {
            customerPhone = toClean
            direction = 'outgoing'
          } else {
            customerPhone = fromClean
            direction = 'incoming'
          }
        }

        // Determine which bucket this call belongs to (by CRM assignment or unassigned)
        const last10 = customerPhone ? customerPhone.slice(-10) : ''
        
        // Look up CRM assignment if we have a phone number
        let assignedTo: string = unassignedKey
        if (last10) {
          assignedTo = phoneToEmployeeMap.get(last10) || unassignedKey
        }

        const stats = employeeStatsMap.get(assignedTo)
        if (stats) {
          const statusStr = String(log.status).toLowerCase()
          const isMissed = ['busy', 'no-answer', 'failed', 'timeout'].includes(statusStr)

          stats.total++
          if (isMissed) {
            stats.missed++
            stats.notPicked++
            if (statusStr.includes('busy')) {
              stats.missedBreakdown.busy++
            } else if (statusStr.includes('no-answer') || statusStr.includes('no_answer')) {
              stats.missedBreakdown['no-answer']++
            } else {
              stats.missedBreakdown.failed++
            }
          } else {
            stats.picked++
            if (direction === 'incoming') {
              stats.incoming++
            } else {
              stats.outgoing++
            }
          }

          // Only add to callLogsList if we have a real customer phone (for lead matching in frontend)
          if (last10) {
            callLogsList.push({
              id: log.id,
              customerPhone: last10,
              direction,
              status: log.status,
              isPicked: !isMissed,
              assignedTo,
              createdAt: log.created_at,
              recordingUrl: log.recording_url || null
            })
          }
        }
      }
    }

    // Fetch wallet balance from organizations table in Voice SaaS database
    let walletBalance = 0
    try {
      const { data: orgData, error: orgErr } = await queryClient
        .from('organizations')
        .select('wallet_balance')
        .eq('id', voiceOrgId)
        .maybeSingle()
      
      if (!orgErr && orgData) {
        walletBalance = Number(orgData.wallet_balance) || 0
      } else if (orgErr) {
        console.error('[Call Analytics API] Error fetching wallet balance:', orgErr.message)
      }
    } catch (balanceErr: any) {
      console.error('[Call Analytics API] Wallet fetch error:', balanceErr.message)
    }

    // Format output payload
    const result = {
      walletBalance,
      allTeam: {
        outgoing: 0,
        incoming: 0,
        missed: 0,
        total: 0,
        picked: 0,
        notPicked: 0,
        missedBreakdown: { busy: 0, 'no-answer': 0, failed: 0 }
      },
      employees: [] as any[],
      callLogs: callLogsList
    }


    employeeStatsMap.forEach((stats, empId) => {
      if (empId !== unassignedKey) {
        const empInfo = employeeMap.get(empId)
        result.employees.push({
          id: empId,
          name: empInfo?.name || 'Unknown',
          email: empInfo?.email || '',
          ...stats
        })
      }

      result.allTeam.outgoing += stats.outgoing
      result.allTeam.incoming += stats.incoming
      result.allTeam.missed += stats.missed
      result.allTeam.total += stats.total
      result.allTeam.picked += stats.picked
      result.allTeam.notPicked += stats.notPicked
      result.allTeam.missedBreakdown.busy += stats.missedBreakdown.busy
      result.allTeam.missedBreakdown['no-answer'] += stats.missedBreakdown['no-answer']
      result.allTeam.missedBreakdown.failed += stats.missedBreakdown.failed
    })

    // Add unassigned category for transparency
    const unassignedStats = employeeStatsMap.get(unassignedKey)
    if (unassignedStats && (unassignedStats.total > 0 || unassignedStats.outgoing > 0 || unassignedStats.incoming > 0 || unassignedStats.missed > 0)) {
      result.employees.push({
        id: unassignedKey,
        name: 'Unassigned Leads',
        email: '',
        ...unassignedStats
      })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[Call Analytics API] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
