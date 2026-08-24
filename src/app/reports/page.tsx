'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  Download,
  Printer,
  Calendar,
  Filter,
  RefreshCw,
  Phone,
  ArrowRight,
  DollarSign,
  CheckCircle2,
  PieChart as PieIcon,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { getLeadColumn } from '@/components/lead/LeadBoard'

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

type TimeRange = 'today' | '7days' | 'month' | 'all'

export default function ReportsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7days')
  const [leads, setLeads] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [leadsRes, convsRes, invoicesRes] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(2000),
        supabase
          .from('conversations')
          .select('id, name, phone_number, stage, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(2000),
        supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(500),
      ])

      const leadMap = new Map<string, any>()
      if (convsRes.data) {
        convsRes.data.forEach((c) => {
          leadMap.set(c.id, {
            id: c.id,
            conversation_id: c.id,
            name: c.name || c.phone_number,
            phone_number: c.phone_number,
            stage: c.stage || 'new',
            source: 'WhatsApp CRM',
            created_at: c.created_at || c.updated_at,
          })
        })
      }
      if (leadsRes.data) {
        leadsRes.data.forEach((l) => {
          const key = l.conversation_id || l.id
          const existing = leadMap.get(key)
          leadMap.set(key, {
            ...existing,
            ...l,
            id: l.id || existing?.id,
            stage: l.stage || existing?.stage || 'new',
          })
        })
      }

      setLeads(Array.from(leadMap.values()))
      setInvoices(invoicesRes.data || [])
    } catch (err) {
      console.error('Error fetching reports data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter by time range
  const filteredLeads = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
    const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()

    return leads.filter((l) => {
      if (timeRange === 'all') return true
      if (!l.created_at) return false
      const t = new Date(l.created_at).getTime()
      if (isNaN(t)) return false

      if (timeRange === 'today') return t >= startOfToday
      if (timeRange === '7days') return t >= startOf7Days
      if (timeRange === 'month') return t >= startOfMonth
      return true
    })
  }, [leads, timeRange])

  const filteredInvoices = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
    const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime()

    return invoices.filter((inv) => {
      if (timeRange === 'all') return true
      const dateStr = inv.issue_date || inv.created_at
      if (!dateStr) return false
      const t = new Date(dateStr).getTime()
      if (isNaN(t)) return false

      if (timeRange === 'today') return t >= startOfToday
      if (timeRange === '7days') return t >= startOf7Days
      if (timeRange === 'month') return t >= startOfMonth
      return true
    })
  }, [invoices, timeRange])

  // Metrics
  const totalLeadsCount = filteredLeads.length

  const convertedCount = filteredLeads.filter((l) => {
    const col = getLeadColumn(l.stage, l.created_at)
    return col === 'confirm'
  }).length

  const interestedCount = filteredLeads.filter((l) => {
    const col = getLeadColumn(l.stage, l.created_at)
    return col === 'interested'
  }).length

  const inProcessCount = filteredLeads.filter((l) => {
    const col = getLeadColumn(l.stage, l.created_at)
    return col === 'processing'
  }).length

  const newCount = filteredLeads.filter((l) => {
    const col = getLeadColumn(l.stage, l.created_at)
    return col === 'new'
  }).length

  const cancelCount = filteredLeads.filter((l) => {
    const col = getLeadColumn(l.stage, l.created_at)
    return col === 'cancel'
  }).length

  const conversionRate = totalLeadsCount > 0 ? ((convertedCount / totalLeadsCount) * 100).toFixed(1) : '0'

  const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0)
  const paidRevenue = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.paid_amount) || 0), 0)

  // Stage Breakdown for BarChart
  const stageChartData = [
    { name: 'New Leads', count: newCount, fill: '#0d9488' },
    { name: 'Interested', count: interestedCount, fill: '#65a30d' },
    { name: 'In Process', count: inProcessCount, fill: '#312e81' },
    { name: 'Confirmed', count: convertedCount, fill: '#166534' },
    { name: 'Cancelled', count: cancelCount, fill: '#dc2626' },
  ]

  // Source Breakdown for PieChart & Table
  const sourceStats = useMemo(() => {
    const map: Record<string, { total: number; converted: number }> = {}
    filteredLeads.forEach((l) => {
      const src = l.source || 'WhatsApp CRM'
      if (!map[src]) map[src] = { total: 0, converted: 0 }
      map[src].total += 1
      if (getLeadColumn(l.stage, l.created_at) === 'confirm') {
        map[src].converted += 1
      }
    })

    return Object.entries(map).map(([name, data]) => ({
      name,
      value: data.total,
      converted: data.converted,
      rate: data.total > 0 ? ((data.converted / data.total) * 100).toFixed(1) : '0',
    }))
  }, [filteredLeads])

  // Export CSV
  const handleExportReportCSV = () => {
    const headers = ['Lead Name', 'Phone Number', 'Company', 'Stage', 'Source', 'Created Date']
    const rows = filteredLeads.map((l) => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.phone_number || '').replace(/"/g, '""')}"`,
      `"${(l.company_name || '').replace(/"/g, '""')}"`,
      `"${(l.stage || 'new').replace(/"/g, '""')}"`,
      `"${(l.source || 'WhatsApp CRM').replace(/"/g, '""')}"`,
      `"${l.created_at ? new Date(l.created_at).toLocaleString() : ''}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `business_report_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-8">
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Business Reports & Analytics</h1>
            </div>
            <p className="text-xs text-gray-500">
              Live conversion metrics, revenue performance, channel distribution, and pipeline health
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Time Range Tabs */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setTimeRange('today')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === 'today'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimeRange('7days')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === '7days'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeRange('month')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === 'month'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setTimeRange('all')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  timeRange === 'all'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs font-bold'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                All Time
              </button>
            </div>

            {/* Export Report CSV */}
            <button
              onClick={handleExportReportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
              title="Download CSV Report"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            {/* Print Report */}
            <button
              onClick={() => window.print()}
              className="p-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl transition-colors"
              title="Print Summary"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>

            {/* Open Voice AI Analytics */}
            <Link
              href="/analytics"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Call Analytics</span>
            </Link>
          </div>
        </div>

        {/* 4 Scorecard KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Leads */}
          <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Leads Analyzed</span>
              <span className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 rounded-xl">
                <Users className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-gray-900 dark:text-white">{totalLeadsCount}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 font-medium">
                <span className="text-indigo-600 font-bold">{newCount} fresh</span> in pipeline
              </p>
            </div>
          </div>

          {/* 2. Lead Conversion Rate */}
          <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Conversion Rate</span>
              <span className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-emerald-600">{conversionRate}%</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 font-medium">
                <span className="text-emerald-600 font-bold">{convertedCount} confirmed</span> / closed orders
              </p>
            </div>
          </div>

          {/* 3. Invoiced Revenue */}
          <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Invoiced Revenue</span>
              <span className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-blue-600">₹{totalRevenue.toLocaleString('en-IN')}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 font-medium">
                <span className="text-blue-600 font-bold">₹{paidRevenue.toLocaleString('en-IN')}</span> collected
              </p>
            </div>
          </div>

          {/* 4. Active Discussions */}
          <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Active Review</span>
              <span className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
                <MessageSquare className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <p className="text-3xl font-black text-amber-600">{inProcessCount + interestedCount}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1 font-medium">
                <span className="text-amber-600 font-bold">{interestedCount} hot</span> + {inProcessCount} follow-ups
              </p>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart: Stage Progression */}
          <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">Pipeline Stage Volume</h3>
                <p className="text-xs text-gray-500">Distribution across CRM pipeline stages</p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg font-bold text-gray-600 dark:text-gray-300">
                {totalLeadsCount} Total
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stageChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      borderColor: '#374151',
                      borderRadius: '0.75rem',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {stageChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart: Lead Sources */}
          <div className="bg-white dark:bg-gray-950 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">Lead Acquisition Sources</h3>
                <p className="text-xs text-gray-500">Where your high-intent inquiries originate</p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg font-bold text-gray-600 dark:text-gray-300">
                {sourceStats.length} Channels
              </span>
            </div>

            <div className="h-64 w-full flex items-center justify-center">
              {sourceStats.length === 0 ? (
                <div className="text-center text-gray-400 text-xs">No source data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {sourceStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        borderColor: '#374151',
                        borderRadius: '0.75rem',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Channel & Source Performance Table */}
        <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Channel Conversion Performance</h3>
              <p className="text-xs text-gray-500">Conversion efficiency across advertising and outreach sources</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Source Channel</th>
                  <th className="p-3.5">Total Inquiries</th>
                  <th className="p-3.5">Confirmed Deals</th>
                  <th className="p-3.5">Conversion Rate</th>
                  <th className="p-3.5">Channel Share</th>
                  <th className="p-3.5 text-right">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sourceStats.map((src, idx) => {
                  const share = totalLeadsCount > 0 ? ((src.value / totalLeadsCount) * 100).toFixed(1) : '0'
                  return (
                    <tr key={src.name} className="hover:bg-gray-50/70 dark:hover:bg-gray-900/60 transition-colors">
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <span>{src.name}</span>
                      </td>
                      <td className="p-3.5 font-mono font-semibold">{src.value} leads</td>
                      <td className="p-3.5 font-mono text-emerald-600 font-bold">{src.converted} closed</td>
                      <td className="p-3.5 font-bold text-indigo-600">{src.rate}%</td>
                      <td className="p-3.5 text-gray-500 font-mono">{share}%</td>
                      <td className="p-3.5 text-right">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            Number(src.rate) >= 20
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {Number(src.rate) >= 20 ? '🔥 High Yield' : '✨ Steady'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
