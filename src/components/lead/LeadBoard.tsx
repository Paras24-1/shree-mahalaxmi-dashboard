'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LeadCard from './LeadCard'
import LeadColumn from './LeadColumn'
import {
  ChevronLeft,
  BarChart2,
  Filter,
  CloudDownload,
  MoreVertical,
  Plus,
  Search,
  X,
  RefreshCw,
  Check,
  Calendar,
  RotateCcw,
  LayoutGrid,
  List,
} from 'lucide-react'

export function getLeadColumn(stage: string | undefined | null, createdAt?: string): string {
  const s = (stage || 'new').toLowerCase().trim()

  if (['confirm', 'confirmed', 'completed', 'deal_done', 'booked', 'won', 'closed'].includes(s)) {
    return 'confirm'
  }

  if (['cancel', 'cancelled', 'not_interested', 'lost', 'rejected', 'junk', 'low_budget'].includes(s)) {
    return 'cancel'
  }

  if (['interested', 'hot_customer', 'hot_lead', 'booking', 'proposal_sent', 'quotation', 'pricing', 'close_by', 'closeby'].includes(s)) {
    return 'interested'
  }

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

  if (s === 'new' || !stage) {
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime()
      if (!isNaN(createdTime)) {
        const ageHours = (Date.now() - createdTime) / (1000 * 60 * 60)
        if (ageHours <= 24) {
          return 'new'
        }
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

const SOURCES = ['All', 'India Mart', 'Face Book', 'Google Ads', 'WhatsApp CRM', 'Referral']

export default function LeadBoard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramFilter = searchParams?.get('filter')

  const [leads, setLeads] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [employeeMap, setEmployeeMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStageTab, setActiveStageTab] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterType>(
    paramFilter === 'today' ? 'today' : paramFilter === 'yesterday' ? 'yesterday' : 'all'
  )
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [sourceFilter, setSourceFilter] = useState('All')
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'card_list' | 'kanban'>('card_list')

  // Pagination / Chunk Rendering for fast scroll
  const [renderLimit, setRenderLimit] = useState(40)

  // Modals & Menus
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // Add Lead Form State
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newSource, setNewSource] = useState('India Mart')
  const [newStage, setNewStage] = useState('new')
  const [savingLead, setSavingLead] = useState(false)

  const filterRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false)
      }
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Unified Lead Loader: Combines leads table + conversations table + employee names
  const fetchLeads = async () => {
    setLoading(true)
    try {
      const [leadsRes, convsRes, usersRes] = await Promise.all([
        supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase
          .from('conversations')
          .select('id, name, phone_number, stage, assigned_to, notes, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(2000),
        supabase
          .from('users')
          .select('id, name, email')
          .limit(200),
      ])

      const empMap = new Map<string, string>()
      if (usersRes.data) {
        setEmployees(usersRes.data)
        usersRes.data.forEach((u) => {
          if (u.id) empMap.set(u.id, u.name || u.email || 'Team Member')
        })
        setEmployeeMap(empMap)
      }

      const leadMap = new Map<string, any>()

      // 1. Load all conversations as base leads
      if (convsRes.data) {
        convsRes.data.forEach((c) => {
          const empName = c.assigned_to ? empMap.get(c.assigned_to) : null
          leadMap.set(c.id, {
            id: c.id,
            conversation_id: c.id,
            name: c.name || (c.phone_number ? `Lead ${c.phone_number.slice(-4)}` : 'Customer'),
            phone_number: c.phone_number,
            stage: c.stage || 'new',
            source: 'WhatsApp Direct',
            assigned_to: c.assigned_to,
            assigned_to_name: empName || (c.assigned_to && !c.assigned_to.includes('-') ? c.assigned_to : 'Priyanka Kamble'),
            notes: c.notes || null,
            created_at: c.created_at || c.updated_at || new Date().toISOString(),
          })
        })
      }

      // 2. Merge with leads table records for rich metadata (company, notes, specific source, etc.)
      if (leadsRes.data) {
        leadsRes.data.forEach((l) => {
          const key = l.conversation_id || l.id
          const existing = leadMap.get(key)
          const empName = l.assigned_to ? empMap.get(l.assigned_to) : null

          leadMap.set(key, {
            ...existing,
            ...l,
            id: l.id || existing?.id,
            conversation_id: l.conversation_id || existing?.conversation_id || l.id,
            name: l.name || existing?.name || (l.phone_number ? `Lead ${l.phone_number.slice(-4)}` : 'Customer'),
            phone_number: l.phone_number || existing?.phone_number,
            stage: l.stage || existing?.stage || 'new',
            source: l.source || existing?.source || 'India Mart',
            company_name: l.company_name || existing?.company_name || null,
            assigned_to: l.assigned_to || existing?.assigned_to,
            assigned_to_name: empName || existing?.assigned_to_name || (l.assigned_to && !l.assigned_to.includes('-') ? l.assigned_to : 'Priyanka Kamble'),
            notes: l.notes || existing?.notes || null,
            followup_date: l.followup_date || existing?.followup_date || null,
            followup_notes: l.followup_notes || existing?.followup_notes || null,
            created_at: l.created_at || existing?.created_at,
          })
        })
      }

      const mergedLeads = Array.from(leadMap.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )

      setLeads(mergedLeads)
    } catch (err) {
      console.error('Error fetching unified leads:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()

    // Real-time subscription to leads & conversations
    const leadChannel = supabase
      .channel(`leads-unified-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => fetchLeads()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => fetchLeads()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(leadChannel)
    }
  }, [])

  // Optimistic 0ms Stage Change Handler with Dual Database Sync
  const handleStageChange = useCallback(async (leadId: string, newStage: string) => {
    // 1. Instant optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId || l.conversation_id === leadId ? { ...l, stage: newStage } : l))
    )

    // 2. Background update to leads and conversations
    try {
      await Promise.all([
        supabase
          .from('leads')
          .update({ stage: newStage, updated_at: new Date().toISOString() })
          .or(`id.eq.${leadId},conversation_id.eq.${leadId}`),
        supabase
          .from('conversations')
          .update({ stage: newStage, updated_at: new Date().toISOString() })
          .eq('id', leadId),
      ])
    } catch (err) {
      console.error('Failed to change stage:', err)
    }
  }, [])

  // Update Lead Details (Notes, Reminders, etc.)
  const handleUpdateLead = useCallback((leadId: string, updates: Partial<any>) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId || l.conversation_id === leadId ? { ...l, ...updates } : l))
    )
  }, [])

  // Delete Lead Handler
  const handleDelete = useCallback(async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead?')) return
    setLeads((prev) => prev.filter((l) => l.id !== leadId && l.conversation_id !== leadId))
    try {
      await Promise.all([
        supabase
          .from('leads')
          .delete()
          .or(`id.eq.${leadId},conversation_id.eq.${leadId}`),
        supabase
          .from('conversations')
          .delete()
          .eq('id', leadId),
      ])
    } catch (err) {
      console.error('Failed to delete lead:', err)
    }
  }, [])

  // Create Lead Handler
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setSavingLead(true)
    try {
      const nowISO = new Date().toISOString()
      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: newName.trim(),
          phone_number: newPhone.trim() || null,
          company_name: newCompany.trim() || null,
          source: newSource,
          stage: newStage,
          created_at: nowISO,
        })
        .select()
        .single()

      if (error) throw error
      if (data) {
        setLeads((prev) => [data, ...prev])
        setShowAddModal(false)
        setNewName('')
        setNewPhone('')
        setNewCompany('')
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create lead')
    } finally {
      setSavingLead(false)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const rows = filteredLeads.map((l) => ({
      Name: l.name || '',
      Phone: l.phone_number || '',
      Company: l.company_name || '',
      Source: l.source || '',
      Stage: l.stage || 'new',
      'Follow-up Reminder': l.followup_date || '',
      Notes: l.notes || '',
      'Created At': l.created_at || '',
    }))

    if (rows.length === 0) {
      alert('No leads to export')
      return
    }

    const headers = Object.keys(rows[0]).join(',')
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows.map((r) => Object.values(r).map((v) => `"${v}"`).join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Toggle selection
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Fast In-Memory Filtered Leads
  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return leads.filter((lead) => {
      // 1. Search filter
      if (q) {
        const nameMatch = lead.name?.toLowerCase().includes(q)
        const phoneMatch = lead.phone_number?.toLowerCase().includes(q)
        const companyMatch = lead.company_name?.toLowerCase().includes(q)
        const sourceMatch = lead.source?.toLowerCase().includes(q)
        const notesMatch = lead.notes?.toLowerCase().includes(q)
        if (!nameMatch && !phoneMatch && !companyMatch && !sourceMatch && !notesMatch) return false
      }

      // 2. Date filter
      if (!matchesDateFilter(lead.created_at, dateFilter, customStartDate, customEndDate)) {
        return false
      }

      // 3. Source filter
      if (sourceFilter !== 'All' && lead.source !== sourceFilter) {
        return false
      }

      // 4. Stage Tab filter
      if (activeStageTab !== 'all') {
        const col = getLeadColumn(lead.stage, lead.created_at)
        if (col !== activeStageTab) return false
      }

      return true
    })
  }, [leads, searchQuery, dateFilter, customStartDate, customEndDate, sourceFilter, activeStageTab])

  // Count calculations for Status Tabs
  const stageCounts = useMemo(() => {
    const dateFiltered = leads.filter((l) =>
      matchesDateFilter(l.created_at, dateFilter, customStartDate, customEndDate)
    )

    let totalAll = dateFiltered.length
    let newCount = 0
    let processingCount = 0
    let interestedCount = 0
    let confirmCount = 0
    let cancelCount = 0

    dateFiltered.forEach((l) => {
      const col = getLeadColumn(l.stage, l.created_at)
      if (col === 'new') newCount++
      else if (col === 'processing') processingCount++
      else if (col === 'interested') interestedCount++
      else if (col === 'confirm') confirmCount++
      else if (col === 'cancel') cancelCount++
    })

    return {
      all: totalAll,
      new: newCount,
      processing: processingCount,
      interested: interestedCount,
      confirm: confirmCount,
      cancel: cancelCount,
    }
  }, [leads, dateFilter, customStartDate, customEndDate])

  const STAGE_TABS = [
    { id: 'all', label: 'All', count: stageCounts.all, dotColor: 'bg-purple-500', amount: '0.0' },
    { id: 'new', label: 'New', count: stageCounts.new, dotColor: 'bg-sky-500', amount: '0.0' },
    { id: 'processing', label: 'Processing', count: stageCounts.processing, dotColor: 'bg-indigo-500', amount: '0.0' },
    { id: 'interested', label: 'Interested', count: stageCounts.interested, dotColor: 'bg-lime-500', amount: '0.0' },
    { id: 'confirm', label: 'Confirm', count: stageCounts.confirm, dotColor: 'bg-emerald-500', amount: '0.0' },
    { id: 'cancel', label: 'Cancel', count: stageCounts.cancel, dotColor: 'bg-rose-500', amount: '0.0' },
  ]

  // Reset render limit when tab or filter changes
  useEffect(() => {
    setRenderLimit(40)
  }, [activeStageTab, searchQuery, dateFilter, sourceFilter])

  // Lazy render more items as user scrolls near bottom
  const visibleLeads = useMemo(() => {
    return filteredLeads.slice(0, renderLimit)
  }, [filteredLeads, renderLimit])

  const activeFilterCount = (sourceFilter !== 'All' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0)

  if (loading && leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 1. Purple Gradient Header */}
      <div className="bg-gradient-to-r from-[#6A1B9A] via-[#7B1FA2] to-[#4A148C] text-white px-4 py-3 rounded-2xl shadow-md flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            title="Go Back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <h1 className="text-base sm:text-lg font-bold tracking-tight">Leads</h1>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-white">
          {/* Analytics Icon */}
          <button
            onClick={() => router.push('/reports')}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            title="Business Analytics & Reports"
          >
            <BarChart2 className="w-4 h-4" />
          </button>

          {/* Filter Icon */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterMenu((v) => !v)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors relative"
              title="Filter Leads"
            >
              <Filter className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-gray-800 dark:text-gray-200">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="font-bold text-gray-900 dark:text-white">Filter Leads</span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={() => {
                        setSourceFilter('All')
                        setDateFilter('all')
                        setCustomStartDate('')
                        setCustomEndDate('')
                      }}
                      className="text-[11px] text-purple-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Date Range
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 font-semibold"
                  >
                    <option value="all">All Dates ({leads.length})</option>
                    <option value="today">Today's Leads</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="this_week">Last 7 Days</option>
                    <option value="custom">Custom Date</option>
                  </select>
                </div>

                {dateFilter === 'custom' && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-xs"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Lead Source
                  </label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 font-semibold"
                  >
                    {SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setShowFilterMenu(false)}
                  className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-xs text-center"
                >
                  Apply Filters
                </button>
              </div>
            )}
          </div>

          {/* Export / Download Icon */}
          <button
            onClick={handleExportCSV}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            title="Download CSV"
          >
            <CloudDownload className="w-4 h-4" />
          </button>

          {/* Three Dots More Menu */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              title="More Actions"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-1.5 z-50 text-xs text-gray-800 dark:text-gray-200">
                <button
                  onClick={() => {
                    fetchLeads()
                    setShowMoreMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Leads</span>
                </button>
                <button
                  onClick={() => {
                    setViewMode(viewMode === 'card_list' ? 'kanban' : 'card_list')
                    setShowMoreMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  {viewMode === 'card_list' ? <LayoutGrid className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
                  <span>Switch to {viewMode === 'card_list' ? 'Kanban View' : 'Card List View'}</span>
                </button>
                <button
                  onClick={() => {
                    handleExportCSV()
                    setShowMoreMenu(false)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>

          {/* Plus / Add Lead Icon */}
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-bold"
            title="Add Lead"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Clean White Search Bar */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search leads by name, phone, company, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-purple-600 font-medium transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 3. Horizontal Scrollable Stage Filter Chips / Cards */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-3.5">
        {STAGE_TABS.map((tab) => {
          const isSelected = activeStageTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveStageTab(tab.id)}
              className={`
                flex flex-col items-start px-3.5 py-2 rounded-xl border transition-all shrink-0 min-w-[105px]
                ${
                  isSelected
                    ? 'bg-[#E3F2FD] dark:bg-sky-950/40 border-[#90CAF9] dark:border-sky-800 text-[#0D47A1] dark:text-sky-300 shadow-xs scale-102'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
                <span className={`w-1.5 h-1.5 rounded-full ${tab.dotColor}`} />
                <span>
                  {tab.label} ({tab.count})
                </span>
              </div>
              <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                <span>💵</span>
                <span>₹{tab.amount}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* 4. Leads Cards View (Default) vs Kanban Board */}
      {viewMode === 'card_list' ? (
        <div className="flex-1 overflow-y-auto space-y-3 pb-12 pr-0.5">
          {filteredLeads.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No leads found in this stage</p>
              <button
                onClick={() => {
                  setActiveStageTab('all')
                  setSearchQuery('')
                  setDateFilter('all')
                  setSourceFilter('All')
                }}
                className="mt-2 text-xs text-purple-600 font-bold hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              {visibleLeads.map((lead) => (
                <LeadCard
                  key={lead.id || lead.conversation_id}
                  lead={lead}
                  isSelected={selectedLeadIds.has(lead.id || lead.conversation_id)}
                  employeeMap={employeeMap}
                  onToggleSelect={handleToggleSelect}
                  onDelete={handleDelete}
                  onStageChange={handleStageChange}
                  onUpdateLead={handleUpdateLead}
                />
              ))}

              {/* Load More Trigger Button when leads exceed render limit */}
              {visibleLeads.length < filteredLeads.length && (
                <div className="text-center py-3">
                  <button
                    onClick={() => setRenderLimit((prev) => prev + 50)}
                    className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold shadow-xs hover:bg-gray-50"
                  >
                    Load More Leads ({visibleLeads.length} of {filteredLeads.length})
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* Kanban View Option */
        <div className="flex-1 flex overflow-x-auto gap-4 pb-4 min-h-[500px]">
          {STAGE_TABS.filter((t) => t.id !== 'all').map((col) => {
            const colLeads = filteredLeads.filter((l) => getLeadColumn(l.stage, l.created_at) === col.id)
            return (
              <LeadColumn
                key={col.id}
                title={col.label}
                subtitle={`${colLeads.length} leads`}
                count={colLeads.length}
                headerBg="bg-indigo-900"
                colorClass="border-t-indigo-900"
                onDrop={(leadId) => handleStageChange(leadId, col.id)}
              >
                {colLeads.map((lead) => (
                  <LeadCard
                    key={lead.id || lead.conversation_id}
                    lead={lead}
                    isSelected={selectedLeadIds.has(lead.id || lead.conversation_id)}
                    employeeMap={employeeMap}
                    onToggleSelect={handleToggleSelect}
                    onDelete={handleDelete}
                    onStageChange={handleStageChange}
                    onUpdateLead={handleUpdateLead}
                  />
                ))}
              </LeadColumn>
            )
          })}
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
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-purple-500 outline-none"
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
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shree Industries"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-purple-500 outline-none"
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
                    <option value="India Mart">India Mart</option>
                    <option value="Face Book">Face Book</option>
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
                  className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
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
