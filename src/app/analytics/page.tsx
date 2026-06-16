'use client'

import { useState, useEffect, useMemo } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Users, MessageSquare, CheckCircle, Clock, TrendingUp, X, Loader2, Phone } from 'lucide-react'
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
  const [timeRange, setTimeRange] = useState<'today' | 'weekly' | 'monthly' | 'all'>('all')
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
      const res = await fetch(`/api/call-analytics?timeRange=${timeRange}`)
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
      // Get all conversations (paginated to bypass Supabase 1000 limit)
      let conversations: any[] = []
      let pageConv = 0
      const pageSize = 1000
      let hasMoreConv = true

      while (hasMoreConv) {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
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

      // Get all employees
      const { data: employees } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'employee')

      // Get assignments (paginated to bypass Supabase 1000 limit)
      let assignments: any[] = []
      let pageAssign = 0
      let hasMoreAssign = true

      while (hasMoreAssign) {
        const { data, error } = await supabase
          .from('conversation_assignments')
          .select('*')
          .range(pageAssign * pageSize, (pageAssign + 1) * pageSize - 1)

        if (error) throw error
        if (data && data.length > 0) {
          assignments = [...assignments, ...data]
          pageAssign++
          if (data.length < pageSize) {
            hasMoreAssign = false
          }
        } else {
          hasMoreAssign = false
        }
      }

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
      interested: filteredConvs.filter(c => c.stage === 'interested' || c.stage === 'callback_done_by_ai').length,
      booking: filteredConvs.filter(c => c.stage === 'booking').length,
      confirmed: filteredConvs.filter(c => c.stage === 'confirmed').length,
      completed: filteredConvs.filter(c => c.stage === 'completed').length,
      cancelled: filteredConvs.filter(c => c.stage === 'cancelled').length,
    }

    return {
      stage_counts: stageCounts,
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
      if (selectedCategory === 'interested') {
        return c.stage === 'interested' || c.stage === 'callback_done_by_ai'
      }
      if (selectedCategory === 'callback_done_by_ai') {
        return c.stage === 'callback_done_by_ai'
      }
      return (c.stage || 'new') === selectedCategory
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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-650 dark:text-gray-400" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
              <p className="text-sm text-gray-500">Team performance and conversation insights</p>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            {[
              { id: 'today', label: 'Today' },
              { id: 'weekly', label: 'Weekly (7d)' },
              { id: 'monthly', label: 'Monthly (30d)' },
              { id: 'all', label: 'All Time' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeRange(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            icon={<MessageSquare className="w-5 h-5" />}
            label="Total Conversations"
            value={stats.total_conversations}
            color="blue"
          />
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Assigned"
            value={stats.total_assigned}
            color="green"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Unassigned"
            value={stats.total_unassigned}
            color="amber"
          />
    
    
        </div>

           {/* Lead Stages */}
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
  <div onClick={() => setSelectedCategory('new')} className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
    <StageCard label="New" value={stats.stage_counts.new} color="gray" />
  </div>
  <div onClick={() => setSelectedCategory('callback_done_by_ai')} className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
    <StageCard label="Callback Done by AI" value={stats.stage_counts.callback_done_by_ai} color="blue" />
  </div>
  <div onClick={() => setSelectedCategory('interested')} className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
    <StageCard label="Interested" value={stats.stage_counts.interested} color="indigo" />
  </div>
  <div onClick={() => setSelectedCategory('booking')} className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
    <StageCard label="Booking" value={stats.stage_counts.booking} color="amber" />
  </div>
  <div onClick={() => setSelectedCategory('confirmed')} className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
    <StageCard label="Confirmed" value={stats.stage_counts.confirmed} color="green" />
  </div>
  <div onClick={() => setSelectedCategory('completed')} className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
    <StageCard label="Completed" value={stats.stage_counts.completed} color="purple" />
  </div>
  <div onClick={() => setSelectedCategory('cancelled')} className="cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
    <StageCard label="Cancelled" value={stats.stage_counts.cancelled} color="red" />
  </div>
</div>

        {/* Voice AI Call Analytics Section */}
        <div className="border-t border-gray-250 dark:border-gray-850 pt-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Phone className="w-5 h-5 text-violet-500" />
                Voice AI Call Activity
              </h2>
              <p className="text-xs text-gray-500">Call outcomes and performance for the selected time range</p>
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
                {/* Total Calls Done by AI */}
                <div 
                  onClick={() => setSelectedCategory('call_total')}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98] transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-500 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Total Calls Done by AI</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{activeCallStats.total || 0}</p>
                  </div>
                </div>

                {/* Call Picked */}
                <div 
                  onClick={() => setSelectedCategory('call_picked')}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98] transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Call Picked</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{activeCallStats.picked || 0}</p>
                  </div>
                </div>

                {/* Calls Not Picked */}
                <div 
                  onClick={() => setSelectedCategory('call_not_picked')}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex items-center gap-4 cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.98] transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 rotate-45" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold">Calls Not Picked</p>
                    <p className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{activeCallStats.notPicked || 0}</p>
                  </div>
                </div>
              </div>

              {/* Missed Calls Donut Chart */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
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
                          ? ((item.value / activeCallStats.notPicked) * 100).toFixed(0)
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
            <div className="text-center py-6 text-gray-400 text-xs">Failed to load call analytics.</div>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Chats per Employee
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="assigned" fill="#10b981" name="Total Assigned" />
                <Bar dataKey="active" fill="#3b82f6" name="Active" />
                <Bar dataKey="completed" fill="#8b5cf6" name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Distribution of Chats
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
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

        {/* Employee Performance Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Employee Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400">Employee</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400">Total Assigned</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400">Active</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400">Completed</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 dark:text-gray-400">Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.employees.map((emp, idx) => {
                  const completionRate = emp.total_assigned > 0 
                    ? Math.round((emp.completed / emp.total_assigned) * 100)
                    : 0

                  return (
                    <tr key={emp.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-semibold">
                            {emp.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</p>
                            <p className="text-xs text-gray-500">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="inline-block px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-sm font-semibold">
                          {emp.total_assigned}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="inline-block px-3 py-1 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-sm font-semibold">
                          {emp.active}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="inline-block px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-sm font-semibold">
                          {emp.completed}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-400 to-teal-600 rounded-full transition-all"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
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
                  {selectedCategory === 'call_total' && `Total Calls Done by AI (${matchingConvs.length})`}
                  {selectedCategory === 'call_picked' && `Picked Calls (${matchingConvs.length})`}
                  {selectedCategory === 'call_not_picked' && `Not Picked Calls (${matchingConvs.length})`}
                  {!selectedCategory.startsWith('call_') && `Leads for "${selectedCategory.replace(/_/g, ' ').toUpperCase()}" (${matchingConvs.length})`}
                </h3>
                <p className="text-xs text-gray-500">Filtered by time range: {timeRange.toUpperCase()}</p>
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
                            : 'bg-white border-gray-150 dark:bg-gray-900 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850'
                        }`}
                      >
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {conv.name || 'Unknown'}
                        </p>
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
                {selectedConv ? (
                  <>
                    {/* Selected Lead Header */}
                    <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white">{selectedConv.name || 'Unknown'}</h4>
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
                            <div className="max-w-[75%]">
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
                ) : (
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

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
    purple: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
      <div className={`w-10 h-10 rounded-xl ${colorClasses[color as keyof typeof colorClasses]} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

function StageCard({ label, value, color }: {
  label: string
  value: number
  color: string
}) {
  const colorClasses = {
    gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
    blue: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
    indigo: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400',
    amber: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400',
    green: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400',
    red: 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
  }

  return (
    <div className={`rounded-2xl p-5 border border-gray-200 dark:border-gray-800 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  )
}
