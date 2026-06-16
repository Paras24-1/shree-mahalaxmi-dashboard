import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin as defaultSupabaseAdmin } from '@/lib/supabase'

// Initialize client for Voice SaaS database
const voiceSaasSupabaseUrl = process.env.VOICE_SAAS_SUPABASE_URL
const voiceSaasSupabaseServiceKey = process.env.VOICE_SAAS_SUPABASE_SERVICE_ROLE_KEY

const queryClient = (voiceSaasSupabaseUrl && voiceSaasSupabaseServiceKey)
  ? createClient(voiceSaasSupabaseUrl, voiceSaasSupabaseServiceKey)
  : defaultSupabaseAdmin

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
    // 1. Get all CRM conversations paginated to get assigned_to mappings
    let conversations: any[] = []
    let pageConv = 0
    const pageSize = 1000
    let hasMoreConv = true

    while (hasMoreConv) {
      const { data, error } = await defaultSupabaseAdmin
        .from('conversations')
        .select('phone_number, assigned_to')
        .range(pageConv * pageSize, (pageConv + 1) * pageSize - 1)

      if (error) throw error
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

    // 2. Fetch call logs from Voice SaaS database
    let logsQuery = queryClient
      .from('call_logs')
      .select('id, from_phone_number, to_phone_number, duration_seconds, status, created_at')

    if (hasFilter) {
      logsQuery = logsQuery.gte('created_at', dateFilter.toISOString())
    }

    const { data: callLogs, error: logsError } = await logsQuery
    if (logsError) throw logsError

    // 3. Fetch CRM users (employees)
    const { data: employees, error: empError } = await defaultSupabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('role', 'employee')

    if (empError) throw empError

    // Map customer phone numbers (last 10 digits) to assigned employee ID
    const phoneToEmployeeMap = new Map<string, string>()
    if (conversations) {
      for (const c of conversations) {
        if (c.phone_number) {
          const clean = c.phone_number.replace(/\D/g, '')
          if (clean) {
            const last10 = clean.slice(-10)
            phoneToEmployeeMap.set(last10, c.assigned_to)
          }
        }
      }
    }

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

    // Loop through call logs and aggregate statistics
    if (callLogs) {
      for (const log of callLogs) {
        let customerPhone = ''
        let direction: 'incoming' | 'outgoing' = 'outgoing'

        const fromClean = log.from_phone_number ? log.from_phone_number.replace(/\D/g, '') : ''
        const toClean = log.to_phone_number ? log.to_phone_number.replace(/\D/g, '') : ''

        // Check if caller or recipient is a customer
        const isFromCustomer = fromClean.length >= 10 && !log.from_phone_number.includes('Campaign') && !log.from_phone_number.includes('Outbound')
        const isToCustomer = toClean.length >= 10 && !log.to_phone_number.includes('Campaign') && !log.to_phone_number.includes('XML')

        if (isFromCustomer) {
          customerPhone = fromClean
          direction = 'incoming'
        } else if (isToCustomer) {
          customerPhone = toClean
          direction = 'outgoing'
        }

        if (!customerPhone) continue

        const last10 = customerPhone.slice(-10)
        const assignedTo = phoneToEmployeeMap.get(last10) || unassignedKey

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

          callLogsList.push({
            id: log.id,
            customerPhone: last10,
            direction,
            status: log.status,
            isPicked: !isMissed,
            assignedTo,
            createdAt: log.created_at
          })
        }
      }
    }

    // Format output payload
    const result = {
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
