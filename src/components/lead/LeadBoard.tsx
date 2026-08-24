import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LeadColumn from './LeadColumn'
import LeadCard from './LeadCard'
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  X,
  Check,
  FileText,
  Calendar,
  Download,
  BarChart2,
  Printer,
  LayoutGrid,
  List,
  ChevronDown,
  Phone,
  MessageSquare,
  Trash2,
  ArrowRight,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react'

const COLUMNS = [
  { id: 'new', title: 'New Leads', subtitle: 'Last 24 Hours', headerBg: 'bg-teal-700', colorClass: 'border-t-teal-700' },
  { id: 'interested', title: 'Interested', subtitle: 'Hot & Interested Leads', headerBg: 'bg-lime-600', colorClass: 'border-t-lime-600' },
  { id: 'processing', title: 'In Process', subtitle: 'Follow-up & Review', headerBg: 'bg-indigo-900', colorClass: 'border-t-indigo-900' },
  { id: 'confirm', title: 'Confirm', subtitle: 'Converted / Closed', headerBg: 'bg-green-800', colorClass: 'border-t-green-800' },
  { id: 'cancel', title: 'Cancel', subtitle: 'Not Interested', headerBg: 'bg-red-600', colorClass: 'border-t-red-600' },
]

const SOURCES = ['All', 'WhatsApp CRM', 'Face Book', 'India Mart', 'Google Ads', 'Referral']
const STAGES = [
  { id: 'all', label: 'All Stages' },
  { id: 'new', label: 'New Leads' },
  { id: 'interested', label: 'Interested' },
  { id: 'processing', label: 'In Process' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'cancel', label: 'Cancel' },
]

export function getLeadColumn(stage: string | undefined | null, createdAt?: string): string {
  const s = (stage || 'new').toLowerCase().trim()

  // 1. Explicit Confirm / Deal Closed
  if (['confirm', 'confirmed', 'completed', 'deal_done', 'booked', 'won', 'closed'].includes(s)) {
    return 'confirm'
  }

  // 2. Not Interested -> Cancel
  if (['cancel', 'cancelled', 'not_interested', 'lost', 'rejected', 'junk', 'low_budget'].includes(s)) {
    return 'cancel'
  }

  // 3. Interested leads
  if (['interested', 'hot_customer', 'hot_lead', 'booking', 'proposal_sent', 'quotation', 'pricing', 'close_by', 'closeby'].includes(s)) {
    return 'interested'
  }

  // 4. In Process / Follow-up
  if (
    [
      'processing',
      'in_process',
      'in_discussion',
      'callback_done_by_ai',
      'call_done',
      'followup',
      'not_connected',
    ].includes(s)
  ) {
    return 'processing'
  }

  // 5. New leads:
  // Fresh leads from last 24h go into "New", then after 24h move to "In Process" for review
  if (s === 'new' || !stage) {
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime()
      if (!isNaN(createdTime)) {
        const ageHours = (Date.now() - createdTime) / (1000 * 60 * 60)
        // If created within last 24 hours -> New Leads
        if (ageHours <= 24) {
          return 'new'
        }
        // If older than 24 hours -> move to In Process for review (next 24 hours)
        return 'processing'
      }
    }
    return 'new'
  }

  return 'new'
}

type DateFilterType = 'all' | 'today' | 'yesterday' | 'this_week' | 'custom'

function matchesDateFilter(
  createdAt: string | undefined,
  filter: DateFilterType,
  customStart?: string,
  customEnd?: string
): boolean {
  if (filter === 'all') return true
  if (!createdAt) return false
  const leadTime = new Date(createdAt).getTime()
  if (isNaN(leadTime)) return false

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000

  if (filter === 'today') {
    return leadTime >= startOfToday
  }
  if (filter === 'yesterday') {
    return leadTime >= startOfYesterday && leadTime < startOfToday
  }
  if (filter === 'this_week') {
    return leadTime >= startOfWeek
  }
  if (filter === 'custom') {
    if (!customStart) return true
    const [sY, sM, sD] = customStart.split('-').map(Number)
    const startTime = new Date(sY, sM - 1, sD, 0, 0, 0, 0).getTime()
    if (customEnd) {
      const [eY, eM, eD] = customEnd.split('-').map(Number)
      const endTime = new Date(eY, eM - 1, eD, 23, 59, 59, 999).getTime()
      return leadTime >= startTime && leadTime <= endTime
    } else {
      const endTime = new Date(sY, sM - 1, sD, 23, 59, 59, 999).getTime()
      return leadTime >= startTime && leadTime <= endTime
    }
  }
  return true
}

function formatCustomDateLabel(start: string, end?: string): string {
  if (!start) return 'Custom Date'
  const [sY, sM, sD] = start.split('-').map(Number)
  const d1 = new Date(sY, sM - 1, sD)
  const f1 = d1.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (!end || end === start) return f1
  const [eY, eM, eD] = end.split('-').map(Number)
  const d2 = new Date(eY, eM - 1, eD)
  const f2 = d2.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${f1} - ${f2}`
}

export default function LeadBoard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramFilter = searchParams?.get('filter')

  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilterType>(
    paramFilter === 'today' ? 'today' : paramFilter === 'yesterday' ? 'yesterday' : 'all'
  )
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDateMenu, setShowCustomDateMenu] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('All')
  const [stageFilter, setStageFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showReportsMenu, setShowReportsMenu] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  const reportsRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  const customDateRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (reportsRef.current && !reportsRef.current.contains(event.target as Node)) {
        setShowReportsMenu(false)
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false)
      }
      if (customDateRef.current && !customDateRef.current.contains(event.target as Node)) {
        setShowCustomDateMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update date filter if query params change
  useEffect(() => {
    if (paramFilter === 'today') {
      setDateFilter('today')
    } else if (paramFilter === 'yesterday') {
      setDateFilter('yesterday')
    } else if (paramFilter === 'all') {
      setDateFilter('all')
    }
  }, [paramFilter])

  // New Lead form
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newSource, setNewSource] = useState('Face Book')
  const [newStage, setNewStage] = useState('new')
  const [savingLead, setSavingLead] = useState(false)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Fetch leads table
      const { data: dbLeads } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      // 2. Also fetch conversations to ensure any lead from WhatsApp with a stage is included
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, name, phone_number, stage, created_at, updated_at')
        .order('updated_at', { ascending: false })

      // Merge and deduplicate by phone/conversation_id
      const leadMap = new Map<string, any>()

      // First add conversations as baseline leads
      if (convs) {
        convs.forEach((c) => {
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

      // Merge rich lead entries
      if (dbLeads) {
        dbLeads.forEach((l) => {
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
    } catch (err) {
      console.error('Error fetching leads:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Move lead to new stage
  const handleStageChange = async (leadId: string, targetStage: string) => {
    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId || l.conversation_id === leadId ? { ...l, stage: targetStage } : l))
    )

    try {
      // Update in Supabase
      await supabase.from('leads').update({ stage: targetStage }).or(`id.eq.${leadId},conversation_id.eq.${leadId}`)
      await supabase.from('conversations').update({ stage: targetStage }).eq('id', leadId)
    } catch (err) {
      console.error('Failed to update stage:', err)
    }
  }

  const handleDelete = async (leadId: string) => {
    if (!window.confirm('Delete this lead?')) return
    setLeads((prev) => prev.filter((l) => l.id !== leadId && l.conversation_id !== leadId))
    try {
      await supabase.from('leads').delete().or(`id.eq.${leadId},conversation_id.eq.${leadId}`)
    } catch (err) {
      console.error('Failed to delete lead:', err)
    }
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() && !newPhone.trim()) return
    setSavingLead(true)

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: newName.trim(),
          phone_number: newPhone.trim(),
          company_name: newCompany.trim() || null,
          source: newSource,
          stage: newStage,
        })
        .select()
        .single()

      if (!error && data) {
        setLeads((prev) => [data, ...prev])
      } else {
        await fetchLeads()
      }

      setShowAddModal(false)
      setNewName('')
      setNewPhone('')
      setNewCompany('')
    } catch (err) {
      console.error('Error creating lead:', err)
    } finally {
      setSavingLead(false)
    }
  }

  const handleOpenChat = (lead: any) => {
    const targetId = lead.conversation_id || lead.id || ''
    const phone = lead.phone_number ? encodeURIComponent(lead.phone_number) : ''
    router.push(`/chat?conversation_id=${targetId}&phone=${phone}`)
  }

  // Export to CSV
  const handleExportCSV = () => {
    setShowReportsMenu(false)
    const headers = ['Lead Name', 'Phone Number', 'Company Name', 'Stage', 'Source', 'Created At']
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
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const todayCount = useMemo(() => leads.filter((l) => matchesDateFilter(l.created_at, 'today')).length, [leads])
  const yesterdayCount = useMemo(() => leads.filter((l) => matchesDateFilter(l.created_at, 'yesterday')).length, [leads])
  const thisWeekCount = useMemo(() => leads.filter((l) => matchesDateFilter(l.created_at, 'this_week')).length, [leads])

  const activeFilterCount = (sourceFilter !== 'All' ? 1 : 0) + (stageFilter !== 'all' ? 1 : 0)

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      // 1. Date filter
      if (!matchesDateFilter(l.created_at, dateFilter, customStartDate, customEndDate)) return false

      // 2. Source filter
      if (sourceFilter !== 'All') {
        const src = l.source || 'WhatsApp CRM'
        if (src.toLowerCase() !== sourceFilter.toLowerCase()) return false
      }

      // 3. Stage filter
      if (stageFilter !== 'all') {
        const col = getLeadColumn(l.stage, l.created_at)
        if (col !== stageFilter && (l.stage || 'new').toLowerCase() !== stageFilter.toLowerCase()) return false
      }

      // 4. Search query
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.phone_number && l.phone_number.includes(q)) ||
        (l.company_name && l.company_name.toLowerCase().includes(q))
      )
    })
  }, [leads, searchQuery, dateFilter, customStartDate, customEndDate, sourceFilter, stageFilter])

  if (loading && leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between py-2 sm:py-3 mb-2 flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Leads</h2>
          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            {filteredLeads.length}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Reports Dropdown */}
          <div className="relative" ref={reportsRef}>
            <button
              onClick={() => {
                setShowReportsMenu((v) => !v)
                setShowFilterMenu(false)
              }}
              className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-semibold transition-all ${
                showReportsMenu
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Reports</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-0.5 transition-transform ${showReportsMenu ? 'rotate-180' : ''}`} />
            </button>

            {showReportsMenu && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-1.5 z-40 text-xs animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  Lead Reports & Exports
                </div>
                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-700 dark:text-gray-200"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export to CSV ({filteredLeads.length})</span>
                </button>
                <button
                  onClick={() => {
                    setShowReportsMenu(false)
                    router.push('/analytics')
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-700 dark:text-gray-200"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-violet-500" />
                  <span>Voice & Lead Analytics</span>
                </button>
                <button
                  onClick={() => {
                    setShowReportsMenu(false)
                    window.print()
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-gray-700 dark:text-gray-200 border-t border-gray-100 dark:border-gray-800"
                >
                  <Printer className="w-3.5 h-3.5 text-gray-500" />
                  <span>Print Summary</span>
                </button>
              </div>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => {
                setShowFilterMenu((v) => !v)
                setShowReportsMenu(false)
              }}
              className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-semibold transition-all ${
                showFilterMenu || activeFilterCount > 0
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-0.5 transition-transform ${showFilterMenu ? 'rotate-180' : ''}`} />
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-3 z-40 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="font-bold text-gray-900 dark:text-white">Filter Leads</span>
                  {(sourceFilter !== 'All' || stageFilter !== 'all' || dateFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSourceFilter('All')
                        setStageFilter('all')
                        setDateFilter('all')
                        setCustomStartDate('')
                        setCustomEndDate('')
                      }}
                      className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset All
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Date Range
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) => {
                      const val = e.target.value as DateFilterType
                      setDateFilter(val)
                      if (val !== 'custom') {
                        setCustomStartDate('')
                        setCustomEndDate('')
                      }
                    }}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Dates ({leads.length})</option>
                    <option value="today">Today's Leads ({todayCount})</option>
                    <option value="yesterday">Yesterday ({yesterdayCount})</option>
                    <option value="this_week">Last 7 Days ({thisWeekCount})</option>
                    <option value="custom">Custom Date / Date Range</option>
                  </select>
                </div>

                {dateFilter === 'custom' && (
                  <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">
                        Specific Date (From) *
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-0.5">
                        To Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Lead Source
                  </label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Pipeline Stage
                  </label>
                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {STAGES.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-1 flex gap-2">
                  <button
                    onClick={() => setShowFilterMenu(false)}
                    className="w-full py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold text-xs shadow-sm transition-colors text-center"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* View Toggle (Grid / List) */}
          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-2xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors border-l border-gray-200 dark:border-gray-700 ${
                viewMode === 'list'
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
              title="Table / List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Sub-bar with Search & Date Tabs */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search leads by name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date Filter Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/80 p-1 rounded-xl text-xs">
            <button
              onClick={() => {
                setDateFilter('all')
                setCustomStartDate('')
                setCustomEndDate('')
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                dateFilter === 'all'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              All ({leads.length})
            </button>
            <button
              onClick={() => {
                setDateFilter('today')
                setCustomStartDate('')
                setCustomEndDate('')
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                dateFilter === 'today'
                  ? 'bg-green-600 text-white shadow-xs'
                  : 'text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dateFilter === 'today' ? 'bg-white animate-pulse' : 'bg-green-500'}`} />
              <span>Today's Leads ({todayCount})</span>
            </button>
            <button
              onClick={() => {
                setDateFilter('yesterday')
                setCustomStartDate('')
                setCustomEndDate('')
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                dateFilter === 'yesterday'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Yesterday ({yesterdayCount})
            </button>
            <button
              onClick={() => {
                setDateFilter('this_week')
                setCustomStartDate('')
                setCustomEndDate('')
              }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                dateFilter === 'this_week'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              7 Days ({thisWeekCount})
            </button>

            {/* Custom Date Filter Button & Popover */}
            <div className="relative" ref={customDateRef}>
              <button
                onClick={() => setShowCustomDateMenu((v) => !v)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  dateFilter === 'custom'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {dateFilter === 'custom' && customStartDate
                    ? formatCustomDateLabel(customStartDate, customEndDate)
                    : 'Custom Date'}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showCustomDateMenu ? 'rotate-180' : ''}`} />
              </button>

              {showCustomDateMenu && (
                <div className="absolute left-0 sm:right-0 sm:left-auto mt-1.5 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      Find Leads by Date
                    </span>
                    <button
                      onClick={() => setShowCustomDateMenu(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Specific Date (From) *
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                      To Date (Optional Range)
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomStartDate('')
                        setCustomEndDate('')
                        setDateFilter('all')
                        setShowCustomDateMenu(false)
                      }}
                      className="flex-1 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-colors text-center"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      disabled={!customStartDate}
                      onClick={() => {
                        if (customStartDate) {
                          setDateFilter('custom')
                          setShowCustomDateMenu(false)
                        }
                      }}
                      className="flex-1 py-1.5 bg-indigo-900 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm transition-colors text-center"
                    >
                      Apply Date
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>
          <button
            onClick={() => fetchLeads()}
            className="p-1.5 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 rounded-xl text-gray-600 dark:text-gray-400"
            title="Refresh Leads"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Date Filter Notice Banner */}
      {dateFilter === 'today' && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl mb-3 text-xs text-green-800 dark:text-green-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-bold">Filtered by Today's Leads:</span>
            <span>{filteredLeads.length} lead{filteredLeads.length === 1 ? '' : 's'} found</span>
          </div>
          <button
            onClick={() => setDateFilter('all')}
            className="text-xs font-bold underline hover:text-green-950 dark:hover:text-white flex items-center gap-1"
          >
            <span>Show All Leads ({leads.length})</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {dateFilter === 'custom' && customStartDate && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl mb-3 text-xs text-indigo-800 dark:text-indigo-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-bold">Filtered by Custom Date:</span>
            <span>
              {formatCustomDateLabel(customStartDate, customEndDate)} ({filteredLeads.length} lead
              {filteredLeads.length === 1 ? '' : 's'} found)
            </span>
          </div>
          <button
            onClick={() => {
              setDateFilter('all')
              setCustomStartDate('')
              setCustomEndDate('')
            }}
            className="text-xs font-bold underline hover:text-indigo-950 dark:hover:text-white flex items-center gap-1"
          >
            <span>Show All Leads ({leads.length})</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {dateFilter !== 'all' && dateFilter !== 'today' && dateFilter !== 'custom' && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl mb-3 text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-bold">Filtered by {dateFilter === 'yesterday' ? 'Yesterday' : 'Last 7 Days'}:</span>
            <span>{filteredLeads.length} lead{filteredLeads.length === 1 ? '' : 's'}</span>
          </div>
          <button
            onClick={() => setDateFilter('all')}
            className="text-xs font-bold underline hover:text-blue-950 dark:hover:text-white flex items-center gap-1"
          >
            <span>Clear Filter</span>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main View: Grid (Kanban) vs List (Table) */}
      {viewMode === 'grid' ? (
        <div className="flex-1 flex overflow-x-auto gap-4 pb-4 min-h-[500px]">
          {COLUMNS.map((col) => {
            const columnLeads = filteredLeads.filter((l) => getLeadColumn(l.stage, l.created_at) === col.id)

            return (
              <LeadColumn
                key={col.id}
                title={col.title}
                subtitle={col.subtitle}
                count={columnLeads.length}
                headerBg={col.headerBg}
                colorClass={col.colorClass}
                onDrop={(leadId) => handleStageChange(leadId, col.id)}
              >
                {columnLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-center">
                    <span className="text-xs">No {col.title} Leads</span>
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <LeadCard
                      key={lead.id || lead.conversation_id}
                      lead={lead}
                      onDelete={handleDelete}
                      onStageChange={handleStageChange}
                    />
                  ))
                )}
              </LeadColumn>
            )
          })}
        </div>
      ) : (
        /* Table / List View */
        <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-800 rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
          {filteredLeads.length === 0 ? (
            <div className="py-24 text-center text-gray-400">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No leads match the selected filter</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 font-bold uppercase tracking-wider">
                  <th className="p-3.5">Lead Name</th>
                  <th className="p-3.5">Phone (Direct Call)</th>
                  <th className="p-3.5">Company</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5">Stage</th>
                  <th className="p-3.5">Created Date</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredLeads.map((lead) => {
                  const currentColumn = getLeadColumn(lead.stage, lead.created_at)
                  return (
                    <tr
                      key={lead.id || lead.conversation_id}
                      onClick={() => handleOpenChat(lead)}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 cursor-pointer transition-colors group"
                    >
                      <td className="p-3.5 font-bold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs uppercase">
                            {(lead.name || 'L')[0]}
                          </div>
                          <span>{lead.name || `Lead #${lead.phone_number?.slice(-4) || 'Contact'}`}</span>
                        </div>
                      </td>
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        {lead.phone_number ? (
                          <a
                            href={`tel:${lead.phone_number.replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50 text-green-700 dark:text-green-400 font-mono font-semibold border border-green-200 dark:border-green-800 transition-colors"
                            title={`Call ${lead.phone_number}`}
                          >
                            <Phone className="w-3 h-3 text-green-600 dark:text-green-400" />
                            <span>{lead.phone_number}</span>
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-gray-600 dark:text-gray-300">
                        {lead.company_name || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/40">
                          {lead.source || 'WhatsApp CRM'}
                        </span>
                      </td>
                      <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={currentColumn}
                          onChange={(e) => handleStageChange(lead.id || lead.conversation_id, e.target.value)}
                          className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-semibold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="new">New Leads</option>
                          <option value="interested">Interested</option>
                          <option value="processing">In Process</option>
                          <option value="confirm">Confirm</option>
                          <option value="cancel">Cancel</option>
                        </select>
                      </td>
                      <td className="p-3.5 text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                        {lead.created_at ? new Date(lead.created_at).toLocaleString() : '-'}
                      </td>
                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenChat(lead)}
                            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                            title="Open Chat"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          {lead.phone_number && (
                            <a
                              href={`https://wa.me/${lead.phone_number.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 rounded-lg transition-colors"
                              title="WhatsApp Chat"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(lead.id || lead.conversation_id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950 text-red-500 rounded-lg transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Create New Lead</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Lead Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shree Industries"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Source</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 outline-none font-semibold"
                  >
                    <option value="Face Book">Face Book</option>
                    <option value="India Mart">India Mart</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="WhatsApp CRM">WhatsApp CRM</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Initial Stage</label>
                  <select
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 outline-none font-semibold"
                  >
                    <option value="new">New</option>
                    <option value="interested">Interested</option>
                    <option value="processing">Processing</option>
                    <option value="confirm">Confirm</option>
                    <option value="cancel">Cancel</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="flex-1 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {savingLead ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Lead</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
