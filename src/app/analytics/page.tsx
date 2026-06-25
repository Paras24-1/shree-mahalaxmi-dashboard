'use client'

import { useState, useEffect, useMemo } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Users, MessageSquare, CheckCircle, Clock, TrendingUp, X, Loader2, Phone, UserPlus, Calendar, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'


interface EmployeeStats {
  id: string
  name: string
  email: string
  total_assigned: number
  active: number
  completed: number
  avg_response_time?: number
}

interface Stats {
  stage_counts: {
    new: number
    callback_done_by_ai: number
    interested: number
    booking: number
    confirmed: number
    completed: number
    cancelled: number
    followup: number
    not_interested: number
    call_done: number
    low_budget: number
    hot_customer: number
    not_connected: number
  }
  funnel_counts: {
    new: number
    engaged: number
    booked: number
    converted: number
    dropped: number
  }
  total_conversations: number
  total_assigned: number
  total_unassigned: number
  total_active: number
  total_completed: number
  employees: EmployeeStats[]
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']

export default function AnalyticsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AnalyticsContent />
    </ProtectedRoute>
  )
}

function AnalyticsContent() {
  const [allConversations, setAllConversations] = useState<any[]>([])
  const [allEmployees, setAllEmployees] = useState<any[]>([])
  const [allAssignments, setAllAssignments] = useState<any[]>([])
  const [timeRange, setTimeRange] = useState<'today' | 'weekly' | 'monthly' | 'all'>('weekly')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedConv, setSelectedConv] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loading, setLoading] = useState(true)

  // Call Analytics states
  const [callAnalytics, setCallAnalytics] = useState<any>(null)
  const [loadingCalls, setLoadingCalls] = useState(false)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all')

  useEffect(() => {
    fetchCallAnalytics()
  }, [timeRange])

  const fetchCallAnalytics = async () => {
    setLoadingCalls(true)
    try {
      const res = await fetch(`/api/call-analytics?timeRange=${timeRange}&t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setCallAnalytics(data)
      }
    } catch (err) {
      console.error('Failed to fetch call analytics:', err)
    } finally {
      setLoadingCalls(false)
    }
  }

  const activeCallStats = useMemo(() => {
    const defaultStats = { outgoing: 0, incoming: 0, missed: 0, total: 0, picked: 0, notPicked: 0, missedBreakdown: { busy: 0, 'no-answer': 0, failed: 0 } }
    if (!callAnalytics) return defaultStats
    if (selectedEmployeeId === 'all') return callAnalytics.allTeam || defaultStats
    const emp = callAnalytics.employees.find((e: any) => e.id === selectedEmployeeId)
    return emp || defaultStats
  }, [callAnalytics, selectedEmployeeId])

  const uniqueLeadsStats = useMemo(() => {
    const getLeadsForCategory = (category: 'call_total' | 'call_picked' | 'call_not_picked') => {
      if (!callAnalytics || !callAnalytics.callLogs) return []
      
      const filteredLogs = callAnalytics.callLogs.filter((log: any) => {
        if (selectedEmployeeId === 'all') return true
        return log.assignedTo === selectedEmployeeId
      })

      let targetLogs = filteredLogs
      if (category === 'call_picked') {
        targetLogs = filteredLogs.filter((log: any) => log.isPicked)
      } else if (category === 'call_not_picked') {
        targetLogs = filteredLogs.filter((log: any) => !log.isPicked)
      }

      const targetPhones = new Set(targetLogs.map((log: any) => log.customerPhone))

      return allConversations.filter(c => {
        if (!c.phone_number) return false
        const clean = c.phone_number.replace(/\D/g, '')
        const last10 = clean.slice(-10)
        return targetPhones.has(last10)
      })
    }

    return {
      totalLeads: getLeadsForCategory('call_total').length,
      pickedLeads: getLeadsForCategory('call_picked').length,
      notPickedLeads: getLeadsForCategory('call_not_picked').length
    }
  }, [callAnalytics, selectedEmployeeId, allConversations])

  const missedBreakdownData = useMemo(() => {
    const bd = activeCallStats.missedBreakdown || { busy: 0, 'no-answer': 0, failed: 0 }
    return [
      { name: 'Line Busy', value: bd.busy || 0 },
      { name: 'Not Answered', value: bd['no-answer'] || 0 },
      { name: 'Failed / Timeout', value: bd.failed || 0 }
    ]
  }, [activeCallStats])

  const MISSED_COLORS = ['#f59e0b', '#ef4444', '#8b5cf6']

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // 1. Fetch conversations from the service role API route with cache buster
      const convsRes = await fetch(`/api/conversations?t=${Date.now()}`)
      if (!convsRes.ok) throw new Error('Failed to fetch conversations')
      const conversations = await convsRes.json()

      // 2. Fetch users from the service role API route and filter to get employees with cache buster
      const usersRes = await fetch(`/api/users?t=${Date.now()}`)
      if (!usersRes.ok) throw new Error('Failed to fetch users')
      const allUsers = await usersRes.json()
      const employees = Array.isArray(allUsers) 
        ? allUsers.filter((u: any) => u.role === 'employee') 
        : []

      // 3. Fetch assignments from the service role API route with cache buster
      const assignRes = await fetch(`/api/assignments?t=${Date.now()}`)
      if (!assignRes.ok) throw new Error('Failed to fetch assignments')
      const assignments = await assignRes.json()

      if (conversations && employees) {
        setAllConversations(conversations)
        setAllEmployees(employees)
        setAllAssignments(assignments || [])
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredConversations = (convs: any[], range: string) => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    return convs.filter(c => {
      const createdDate = new Date(c.created_at)
      if (range === 'today') {
        return createdDate >= startOfToday
      }
      if (range === 'weekly') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return createdDate >= sevenDaysAgo
      }
      if (range === 'monthly') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return createdDate >= thirtyDaysAgo
      }
      return true
    })
  }

  const computedStats = useMemo(() => {
    if (allConversations.length === 0) return null

    const filteredConvs = getFilteredConversations(allConversations, timeRange)
    const filteredConvIds = new Set(filteredConvs.map(c => c.id))

    const employeeStats: EmployeeStats[] = allEmployees.map(emp => {
      const assigned = filteredConvs.filter(c => c.assigned_to === emp.id)
      const empAssignments = allAssignments.filter(a => a.assigned_to === emp.id && filteredConvIds.has(a.conversation_id))
      const active = empAssignments.filter(a => a.status === 'active').length
      const completed = empAssignments.filter(a => a.status === 'completed').length

      return {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        total_assigned: assigned.length,
        active,
        completed
      }
    })

    const stageCounts = {
      new: filteredConvs.filter(c => (c.stage || 'new') === 'new').length,
      callback_done_by_ai: filteredConvs.filter(c => c.stage === 'callback_done_by_ai').length,
      interested: filteredConvs.filter(c => c.stage === 'interested').length,
      booking: filteredConvs.filter(c => c.stage === 'booking').length,
      confirmed: filteredConvs.filter(c => c.stage === 'confirmed').length,
      completed: filteredConvs.filter(c => c.stage === 'completed').length,
      cancelled: filteredConvs.filter(c => c.stage === 'cancelled').length,
      followup: filteredConvs.filter(c => c.stage === 'followup').length,
      not_interested: filteredConvs.filter(c => c.stage === 'not_interested').length,
      call_done: filteredConvs.filter(c => c.stage === 'call_done').length,
      low_budget: filteredConvs.filter(c => c.stage === 'low_budget').length,
      hot_customer: filteredConvs.filter(c => c.stage === 'hot_customer').length,
      not_connected: filteredConvs.filter(c => c.stage === 'not_connected').length,
    }

    const funnelCounts = {
      new: stageCounts.new,
      engaged: stageCounts.interested + stageCounts.callback_done_by_ai + stageCounts.followup + stageCounts.hot_customer,
      booked: stageCounts.booking + stageCounts.call_done,
      converted: stageCounts.confirmed + stageCounts.completed,
      dropped: stageCounts.cancelled + stageCounts.low_budget + stageCounts.not_interested + stageCounts.not_connected,
    }

    return {
      stage_counts: stageCounts,
      funnel_counts: funnelCounts,
      total_conversations: filteredConvs.length,
      total_assigned: filteredConvs.filter(c => c.assigned_to).length,
      total_unassigned: filteredConvs.filter(c => !c.assigned_to).length,
      total_active: allAssignments.filter(a => a.status === 'active' && filteredConvIds.has(a.conversation_id)).length,
      total_completed: allAssignments.filter(a => a.status === 'completed' && filteredConvIds.has(a.conversation_id)).length,
      employees: employeeStats
    }
  }, [allConversations, allEmployees, allAssignments, timeRange])

  const stats = computedStats

  const fetchConvMessages = async (convId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/messages?conversation_id=${convId}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data || [])
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const matchingConvs = useMemo(() => {
    if (!selectedCategory) return []

    // If it's call analytics selection:
    if (selectedCategory.startsWith('call_')) {
      if (!callAnalytics || !callAnalytics.callLogs) return []
      
      // Filter call logs by employee selection
      const filteredLogs = callAnalytics.callLogs.filter((log: any) => {
        if (selectedEmployeeId === 'all') return true
        return log.assignedTo === selectedEmployeeId
      })

      // Further filter call logs based on clicked category
      let targetLogs = filteredLogs
      if (selectedCategory === 'call_picked') {
        targetLogs = filteredLogs.filter((log: any) => log.isPicked)
      } else if (selectedCategory === 'call_not_picked') {
        targetLogs = filteredLogs.filter((log: any) => !log.isPicked)
      }

      // Get unique customer phone numbers (last 10 digits)
      const targetPhones = new Set(targetLogs.map((log: any) => log.customerPhone))

      // Return unique conversations that match these phone numbers
      return allConversations.filter(c => {
        if (!c.phone_number) return false
        const clean = c.phone_number.replace(/\D/g, '')
        const last10 = clean.slice(-10)
        return targetPhones.has(last10)
      })
    }

    // Default CRM stages
    return stats ? getFilteredConversations(allConversations, timeRange).filter(c => {
      const stage = c.stage || 'new'
      if (selectedCategory === 'new') {
        return stage === 'new'
      }
      if (selectedCategory === 'engaged') {
        return ['interested', 'callback_done_by_ai', 'followup', 'hot_customer'].includes(stage)
      }
      if (selectedCategory === 'booked') {
        return ['booking', 'call_done'].includes(stage)
      }
      if (selectedCategory === 'converted') {
        return ['confirmed', 'completed'].includes(stage)
      }
      if (selectedCategory === 'dropped') {
        return ['cancelled', 'low_budget', 'not_interested', 'not_connected'].includes(stage)
      }
      if (selectedCategory === 'cancelled_operations') {
        return stage === 'cancelled'
      }
      if (selectedCategory === 'low_budget_limits') {
        return stage === 'low_budget'
      }
      if (selectedCategory === 'not_interested_lost') {
        return ['not_interested', 'not_connected'].includes(stage)
      }
      
      // Fallback for original stages if any
      if (selectedCategory === 'interested') {
        return stage === 'interested' || stage === 'callback_done_by_ai'
      }
      if (selectedCategory === 'callback_done_by_ai') {
        return stage === 'callback_done_by_ai'
      }
      return stage === selectedCategory
    }) : []
  }, [selectedCategory, callAnalytics, selectedEmployeeId, allConversations, timeRange, stats])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-500">Failed to load analytics</p>
      </div>
    )
  }

  const chartData = stats.employees.map(emp => ({
    name: emp.name.split(' ')[0],
    assigned: emp.total_assigned,
    active: emp.active,
    completed: emp.completed
  }))

  const pieData = [
    { name: 'Unassigned', value: stats.total_unassigned },
    ...stats.employees.map(emp => ({
      name: emp.name.split(' ')[0],
      value: emp.total_assigned
    }))
  ]

  const newCount = stats.funnel_counts.new
  const engagedCount = stats.funnel_counts.engaged
  const bookedCount = stats.funnel_counts.booked
  const convertedCount = stats.funnel_counts.converted
  const droppedCount = stats.funnel_counts.dropped

  const engagedPct = newCount > 0 ? Math.round((engagedCount / newCount) * 100) : 0
  const bookedPct = newCount > 0 ? Math.round((bookedCount / newCount) * 100) : 0
  const convertedPct = newCount > 0 ? Math.round((convertedCount / newCount) * 100) : 0

  const dropoff1 = newCount > 0 ? Math.max(0, Math.round(((newCount - engagedCount) / newCount) * 100)) : 0
  const dropoff2 = engagedCount > 0 ? Math.max(0, Math.round(((engagedCount - bookedCount) / engagedCount) * 105)) : 0
  const dropoff3 = bookedCount > 0 ? Math.max(0, Math.round(((bookedCount - convertedCount) / bookedCount) * 105)) : 0

  const overallConversion = stats.total_conversations > 0 
    ? Math.round((convertedCount / stats.total_conversations) * 100)
    : 0

  const sortedEmployees = [...stats.employees].sort((a, b) => {
    const aRate = a.total_assigned > 0 ? (a.completed / a.total_assigned) : 0
    const bRate = b.total_assigned > 0 ? (b.completed / b.total_assigned) : 0
    if (bRate !== aRate) return bRate - aRate
    return b.total_assigned - a.total_assigned
  })

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 text-left">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors animate-pulse"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </Link>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Voice AI Call Activity</h1>
                <p className="text-xs text-gray-550 dark:text-gray-400">Call outcomes and performance for the selected time range</p>
              </div>
              {callAnalytics && callAnalytics.walletBalance !== undefined && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/40 text-violet-750 dark:text-violet-300 shadow-sm ml-2">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${callAnalytics.walletBalance > 0 ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${callAnalytics.walletBalance > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                  </div>
                  <span className="text-xs font-black font-mono">
                    AI Wallet: ₹{Number(callAnalytics.walletBalance).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center bg-gray-150 dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200/50 dark:border-gray-700/50">
            {[
              { id: 'today', label: 'Today' },
              { id: 'weekly', label: 'Weekly (7d)' },
              { id: 'monthly', label: 'Monthly (30d)' },
              { id: 'all', label: 'All Time' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={<MessageSquare className="w-4 h-4" />}
            label="Total Conversations"
            sublabel="TOTAL DATABASE RECORDS SYNC"
            value={stats.total_conversations}
            color="blue"
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Assigned Chats"
            sublabel="MANAGED BY ACTIVE OPERATORS"
            value={stats.total_assigned}
            color="green"
          />
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            label="Unassigned Queue"
            sublabel="AWAITING ASSIGNMENT RESPONSE"
            value={stats.total_unassigned}
            color="amber"
          />
        </div>

        {/* Funnel and Pipeline Health Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversion Funnel */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col shadow-sm">
            <div className="text-left mb-6">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Lead Conversion Funnel
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Visualizing the flow of leads from ingestion to final completion
              </p>
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <FunnelBlock
                icon={<UserPlus className="w-4 h-4" />}
                label="New Leads"
                description="Awaiting operator engagement"
                value={newCount}
                percentageLabel="100% Base"
                color="blue"
                onClick={() => setSelectedCategory('new')}
              />

              <DropoffConnector percentage={dropoff1} />

              <FunnelBlock
                icon={<MessageSquare className="w-4 h-4" />}
                label="Engaged Leads"
                description="Interested / Follow-up / Hot"
                value={engagedCount}
                percentageLabel={`${engagedPct}% of Base`}
                color="purple"
                onClick={() => setSelectedCategory('engaged')}
              />

              <DropoffConnector percentage={dropoff2} />

              <FunnelBlock
                icon={<Calendar className="w-4 h-4" />}
                label="Booked Leads"
                description="Booking / Call completed"
                value={bookedCount}
                percentageLabel={`${bookedPct}% of Base`}
                color="orange"
                onClick={() => setSelectedCategory('booked')}
              />

              <DropoffConnector percentage={dropoff3} />

              <FunnelBlock
                icon={<CheckCircle className="w-4 h-4" />}
                label="Converted Leads"
                description="Confirmed / Won / Closed"
                value={convertedCount}
                percentageLabel={`${convertedPct}% of Base`}
                color="green"
                onClick={() => setSelectedCategory('converted')}
              />
            </div>
          </div>

          {/* Pipeline Health & Leakages */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-between shadow-sm space-y-6">
            <div className="text-left">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Pipeline Health
              </h3>
              <p className="text-xs text-gray-450 dark:text-gray-500">
                Leakage analysis and conversion ratios
              </p>
            </div>

            <div className="space-y-4">
              {/* Overall Conversion Card */}
              <div className="bg-gray-50/50 dark:bg-gray-950/20 border border-gray-150/50 dark:border-gray-850/80 p-4 rounded-2xl flex items-center gap-4 text-left">
                <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="20" className="stroke-gray-100 dark:stroke-gray-850 fill-none" strokeWidth="4" />
                    <circle 
                      cx="24" 
                      cy="24" 
                      r="20" 
                      className="stroke-emerald-500 fill-none transition-all duration-500" 
                      strokeWidth="4" 
                      strokeDasharray={125.6} 
                      strokeDashoffset={125.6 - (125.6 * overallConversion) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-xs font-black text-gray-900 dark:text-white">{overallConversion}%</span>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Overall Conversion</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">Ratio of win deals out of total conversations</p>
                </div>
              </div>

              {/* Dropped Leads Card */}
              <div 
                onClick={() => setSelectedCategory('dropped')}
                className="bg-rose-50/20 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-900/20 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:border-rose-350 dark:hover:border-rose-900/60 transition-all duration-200 text-left shadow-sm"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Dropped Leads</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-450 mt-0.5 leading-snug">Inactive or non-interested pipeline</p>
                  </div>
                </div>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono pr-1">{droppedCount}</span>
              </div>
            </div>

            {/* Leakage Reasons list */}
            <div className="space-y-4 text-left">
              <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Leakage Reasons</p>
              
              <div className="space-y-3.5">
                <LeakageRow
                  label="Cancelled Operations"
                  count={stats.stage_counts.cancelled}
                  total={droppedCount}
                  color="red"
                  onClick={() => setSelectedCategory('cancelled_operations')}
                />
                <LeakageRow
                  label="Low Budget Limits"
                  count={stats.stage_counts.low_budget}
                  total={droppedCount}
                  color="amber"
                  onClick={() => setSelectedCategory('low_budget_limits')}
                />
                <LeakageRow
                  label="Not Interested / Lost"
                  count={stats.stage_counts.not_interested + stats.stage_counts.not_connected}
                  total={droppedCount}
                  color="slate"
                  onClick={() => setSelectedCategory('not_interested_lost')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Voice AI Call Analytics Section */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="text-left">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-violet-500" />
                Voice AI Call Activity
              </h3>
              <p className="text-xs text-gray-450 dark:text-gray-550">Call outcomes and performance for the selected time range</p>
            </div>

            {/* Employee Filter Selector */}
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="block w-full max-w-[200px] px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-250 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm"
            >
              <option value="all">All Team (Overall)</option>
              {allEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  Team - {emp.name}
                </option>
              ))}
              {callAnalytics?.employees?.some((e: any) => e.id === 'unassigned') && (
                <option value="unassigned">Unassigned Leads</option>
              )}
            </select>
          </div>

          {loadingCalls ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : activeCallStats ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Call Stats Summary Cards */}
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 h-fit">
                {/* Total Calls */}
                <div 
                  onClick={() => setSelectedCategory('call_total')}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Voice Calls</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{activeCallStats.total}</p>
                  </div>
                </div>

                {/* Calls Answered */}
                <div 
                  onClick={() => setSelectedCategory('call_picked')}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Calls Answered</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{activeCallStats.picked}</p>
                  </div>
                </div>

                {/* Calls Not Answered */}
                <div 
                  onClick={() => setSelectedCategory('call_not_picked')}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98] transition-all duration-200 text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 rotate-45" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Calls Not Answered</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{activeCallStats.notPicked}</p>
                  </div>
                </div>
              </div>

              {/* Missed Calls Donut Chart */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 text-left">
                    Not Picked Calls Breakdown ({activeCallStats.notPicked || 0})
                  </h3>
                </div>
                {(activeCallStats.notPicked || 0) > 0 ? (
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-full h-[180px] relative flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={missedBreakdownData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {missedBreakdownData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={MISSED_COLORS[index]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f2937', 
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              fontSize: '11px',
                              color: '#fff'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <Phone className="w-5 h-5 text-red-500 rotate-45" />
                        <span className="text-xs font-bold text-gray-550 mt-0.5">{activeCallStats.notPicked || 0} Total</span>
                      </div>
                    </div>
                    {/* Legend */}
                    <div className="grid grid-cols-3 gap-2 w-full mt-2">
                      {missedBreakdownData.map((item, index) => {
                        const percent = activeCallStats.notPicked > 0 
                          ? ((item.value / activeCallStats.notPicked) * 105).toFixed(0)
                          : '0';
                        return (
                          <div key={index} className="flex flex-col items-center text-center">
                            <div className="flex items-center gap-1.5 justify-center">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: MISSED_COLORS[index] }} />
                              <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[65px]">
                                {item.name}
                              </span>
                            </div>
                            <span className="text-xs font-extrabold text-gray-900 dark:text-white mt-0.5">
                              {item.value} ({percent}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                    <Phone className="w-8 h-8 text-gray-300 dark:text-gray-700 mb-2 rotate-45" />
                    <p className="text-xs italic">No missed calls in this period</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-450 text-xs">Failed to load call analytics.</div>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
            <div className="text-left mb-4">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Chats per Employee
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Comparing agent workload, active status, and completions
              </p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: '#fff'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="assigned" fill="#6366f1" name="Total Assigned" radius={[4, 4, 0, 0]} />
                <Bar dataKey="active" fill="#3b82f6" name="Active" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#10b981" name="Completed" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm relative">
            <div className="text-left mb-4">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Distribution of Chats
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Visual share of conversations allocated across team members
              </p>
            </div>
            
            {/* Donut Chart Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-14">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{stats.total_conversations}</span>
              <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mt-0.5">Total Chats</span>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  innerRadius={70}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Performance Leaderboard */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
          <div className="flex items-start gap-2.5 mb-6 text-left">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Team Performance Leaderboard
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Ranked by completion rate and active resolution index
              </p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-3 px-4 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="py-3 px-4 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="py-3 px-4 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">Total Assigned</th>
                  <th className="py-3 px-4 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">Active</th>
                  <th className="py-3 px-4 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-center">Completed</th>
                  <th className="py-3 px-4 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Completion Index</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.map((emp: any, idx: number) => {
                  const completionRate = emp.total_assigned > 0 
                    ? Math.round((emp.completed / emp.total_assigned) * 100)
                    : 0
                  const isTopAgent = idx === 0 && emp.total_assigned > 0

                  return (
                    <tr key={emp.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-855/30 transition-colors">
                      <td className="py-4 px-4 text-xs font-mono font-semibold text-gray-500 dark:text-gray-400">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm">
                            {emp.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-left">
                              <p className="text-xs font-bold text-gray-900 dark:text-white">{emp.name}</p>
                              {isTopAgent && (
                                <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30 text-[8px] font-black text-amber-600 dark:text-amber-400 rounded-md tracking-wider uppercase">
                                  Top Agent 👑
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 text-left">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50/50 text-blue-650 dark:bg-blue-950/40 dark:text-blue-400 text-xs font-mono font-bold border border-blue-100/50 dark:border-blue-900/20">
                          {emp.total_assigned}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50/50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 text-xs font-mono font-bold border border-amber-100/50 dark:border-amber-900/20">
                          {emp.active}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50/50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs font-mono font-bold border border-emerald-100/50 dark:border-emerald-900/20">
                          {emp.completed}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-500"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white font-mono">
                            {completionRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Leads Drawer / Chat Viewer Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {selectedCategory === 'call_total' && `Total Leads Called (${matchingConvs.length})`}
                  {selectedCategory === 'call_picked' && `Leads Answered (${matchingConvs.length})`}
                  {selectedCategory === 'call_not_picked' && `Leads Not Answered (${matchingConvs.length})`}
                  {!selectedCategory.startsWith('call_') && `Leads for "${selectedCategory.replace(/_/g, ' ').toUpperCase()}" (${matchingConvs.length})`}
                </h3>
                <p className="text-xs text-gray-505 text-left">Filtered by time range: {timeRange.toUpperCase()}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedCategory(null)
                  setSelectedConv(null)
                  setMessages([])
                }}
                className="p-2 rounded-xl hover:bg-gray-250 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex overflow-hidden min-h-0">
              {/* Left Column: Lead List */}
              <div className="w-1/3 border-r border-gray-200 dark:border-gray-800 overflow-y-auto p-4 space-y-2">
                {matchingConvs.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-xs">
                    No leads found.
                  </div>
                ) : (
                  matchingConvs.map((conv) => {
                    const isSelected = selectedConv?.id === conv.id
                    
                    // Compute how many times the bot called / was called by this lead
                    const cleanPhone = conv.phone_number ? conv.phone_number.replace(/\D/g, '') : ''
                    const last10 = cleanPhone.slice(-10)
                    const callCount = (callAnalytics?.callLogs && last10)
                      ? callAnalytics.callLogs.filter((log: any) => {
                          const isEmployeeMatch = selectedEmployeeId === 'all' || log.assignedTo === selectedEmployeeId
                          return isEmployeeMatch && log.customerPhone === last10
                        }).length
                      : 0

                    return (
                      <div
                        key={conv.id}
                        onClick={() => {
                          setSelectedConv(conv)
                          fetchConvMessages(conv.id)
                        }}
                        className={`p-3.5 rounded-2xl cursor-pointer transition-all border text-left ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-950/20 dark:border-emerald-500'
                            : 'bg-white border-gray-150 dark:bg-gray-900 dark:border-gray-800 hover:bg-gray-55 dark:hover:bg-gray-850'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {conv.name || 'Unknown'}
                          </p>
                          {callCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-955 text-violet-750 dark:text-violet-400 text-[9px] font-extrabold flex-shrink-0">
                              {callCount} {callCount === 1 ? 'call' : 'calls'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">{conv.phone_number}</p>
                        {conv.last_message && (
                          <p className="text-[10px] text-gray-450 dark:text-gray-500 truncate mt-1">
                            {conv.last_message}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Right Column: Chat Window */}
              <div className="w-2/3 flex flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-950/20">
                {selectedConv ? (() => {
                  const cleanPhone = selectedConv.phone_number ? selectedConv.phone_number.replace(/\D/g, '') : ''
                  const last10 = cleanPhone.slice(-10)
                  const selectedConvCallCount = (callAnalytics?.callLogs && last10)
                    ? callAnalytics.callLogs.filter((log: any) => {
                        const isEmployeeMatch = selectedEmployeeId === 'all' || log.assignedTo === selectedEmployeeId
                        return isEmployeeMatch && log.customerPhone === last10
                      }).length
                    : 0

                  return (
                    <>
                      {/* Selected Lead Header */}
                      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white">{selectedConv.name || 'Unknown'}</h4>
                            {selectedConvCallCount > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-955 text-violet-750 dark:text-violet-400 text-[9px] font-extrabold">
                                {selectedConvCallCount} {selectedConvCallCount === 1 ? 'AI Call' : 'AI Calls'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-505 mt-0.5">{selectedConv.phone_number}</p>
                        </div>
                        <Link
                          href={`/?conversation_id=${selectedConv.id}`}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-[10px] font-semibold transition-all duration-200"
                        >
                          Open Chat in CRM
                        </Link>
                      </div>

                      {/* Chat Messages */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {loadingMessages ? (
                          <div className="h-full flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                          </div>
                        ) : messages.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                            No messages in this chat.
                          </div>
                        ) : (
                          messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div className="max-w-[75%] text-left">
                                <div
                                  className={`rounded-2xl px-4 py-2 text-xs leading-relaxed ${
                                    msg.direction === 'outgoing'
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-gray-950 dark:text-white shadow-sm'
                                  }`}
                                >
                                  {msg.media_url && msg.media_type?.startsWith('image/') && (
                                    <img
                                      src={msg.media_url}
                                      alt="Sent image"
                                      className="rounded-lg mb-2 max-w-full h-auto"
                                    />
                                  )}
                                  {msg.message && <p className="whitespace-pre-wrap break-words">{msg.message}</p>}
                                </div>
                                <p className={`text-[9px] text-gray-450 mt-1 ${msg.direction === 'outgoing' ? 'text-right' : 'text-left'}`}>
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )
                })() : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6">
                    <MessageSquare className="w-12 h-12 mb-3 text-gray-350 dark:text-gray-700 stroke-[1.5]" />
                    <p className="text-xs">Select a lead from the list to view chat history</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, sublabel, value, color }: {
  icon: React.ReactNode
  label: string
  sublabel: string
  value: number
  color: 'blue' | 'green' | 'amber'
}) {
  const bgClasses = {
    blue: 'bg-violet-50/40 dark:bg-violet-950/10 border-violet-100 dark:border-violet-900/30',
    green: 'bg-emerald-50/40 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30',
    amber: 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20',
  }

  const textClasses = {
    blue: 'text-violet-650 dark:text-violet-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-500 dark:text-amber-400',
  }

  const iconBgClasses = {
    blue: 'bg-white dark:bg-violet-950/40 text-violet-500',
    green: 'bg-white dark:bg-emerald-950/40 text-emerald-500',
    amber: 'bg-white dark:bg-amber-950/40 text-amber-500',
  }

  return (
    <div className={`rounded-3xl border p-5 flex flex-col justify-between shadow-sm text-left ${bgClasses[color]}`}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-gray-450 dark:text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-extrabold tracking-tight ${textClasses[color]}`}>{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm border border-gray-100/50 dark:border-gray-800 ${iconBgClasses[color]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-[9px] font-bold tracking-wider text-emerald-650 dark:text-emerald-500/80">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>{sublabel}</span>
      </div>
    </div>
  )
}

interface FunnelBlockProps {
  icon: React.ReactNode
  label: string
  description: string
  value: number
  percentageLabel: string
  color: 'blue' | 'purple' | 'orange' | 'green'
  onClick: () => void
}

function FunnelBlock({ icon, label, description, value, percentageLabel, color, onClick }: FunnelBlockProps) {
  const colorStyles = {
    blue: {
      bg: 'bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30 hover:border-blue-300 dark:hover:border-blue-800',
      iconBg: 'bg-blue-500 text-white',
      text: 'text-blue-605',
    },
    purple: {
      bg: 'bg-purple-50/30 dark:bg-purple-950/10 border-purple-100 dark:border-purple-900/30 hover:border-purple-300 dark:hover:border-purple-800',
      iconBg: 'bg-purple-500 text-white',
      text: 'text-purple-605',
    },
    orange: {
      bg: 'bg-amber-50/20 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/20 hover:border-amber-300 dark:hover:border-amber-800',
      iconBg: 'bg-amber-500 text-white',
      text: 'text-amber-600',
    },
    green: {
      bg: 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-800',
      iconBg: 'bg-emerald-500 text-white',
      text: 'text-emerald-600',
    },
  }

  const style = colorStyles[color]

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-205 cursor-pointer shadow-sm hover:scale-[1.005] active:scale-[0.995] ${style.bg}`}
    >
      <div className="flex items-center gap-3.5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${style.iconBg}`}>
          {icon}
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-gray-905 dark:text-white">{label}</p>
          <p className="text-[10px] text-gray-450 dark:text-gray-500">{description}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xl font-black text-gray-900 dark:text-white">{value}</p>
        <p className="text-[9px] font-bold text-gray-400 dark:text-gray-500/80 tracking-wide uppercase mt-0.5">{percentageLabel}</p>
      </div>
    </div>
  )
}

function DropoffConnector({ percentage }: { percentage: number }) {
  return (
    <div className="relative py-1 flex flex-col items-center">
      <div className="h-8 w-0.5 border-l-2 border-dashed border-gray-250 dark:border-gray-800" />
      <div className="absolute top-1/2 -translate-y-1/2 bg-rose-50 dark:bg-rose-950/50 border border-rose-150 dark:border-rose-900/50 px-2 py-0.5 rounded-full shadow-sm">
        <p className="text-[9px] font-extrabold text-rose-600 dark:text-rose-450 tracking-wide">
          ↓ {percentage}% drop-off
        </p>
      </div>
    </div>
  )
}

function LeakageRow({ label, count, total, color, onClick }: { label: string; count: number; total: number; color: 'red' | 'amber' | 'slate'; onClick: () => void }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0
  const colorClasses = {
    red: 'bg-rose-500 dark:bg-rose-450',
    amber: 'bg-amber-500 dark:bg-amber-450',
    slate: 'bg-slate-650 dark:bg-slate-400',
  }
  return (
    <div onClick={onClick} className="space-y-1 cursor-pointer group">
      <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
        <span>{label}</span>
        <span className="font-mono text-gray-705 dark:text-gray-300">{count} <span className="text-gray-400 dark:text-gray-500 font-medium">({percentage})</span></span>
      </div>
      <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
