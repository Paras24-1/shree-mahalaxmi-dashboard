'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LeadCard from './LeadCard'
import LeadColumn from './LeadColumn'
import { getLeadScore, getLeadScoreValue } from '@/lib/leadScoring'
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
  TrendingUp,
  Sparkles,
  SlidersHorizontal,
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
export type ScoreFilterType =
  | 'all'
  | 'high_70'
  | 'exact'
  | 'min'
  | 'max'
  | 'range'
  | 'hot'
  | 'warm'
  | 'cold'

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

function matchesScoreFilter(
  score: number,
  filterType: ScoreFilterType,
  targetVal?: string,
  minVal?: string,
  maxVal?: string
): boolean {
  if (filterType === 'all') return true
  if (filterType === 'high_70') return score >= 70
  if (filterType === 'hot') return score >= 75
  if (filterType === 'warm') return score >= 45 && score < 75
  if (filterType === 'cold') return score < 45
  if (filterType === 'exact') {
    if (!targetVal) return true
    const num = Number(targetVal)
    return !isNaN(num) ? score === num : true
  }
  if (filterType === 'min') {
    if (!targetVal) return true
    const num = Number(targetVal)
    return !isNaN(num) ? score >= num : true
  }
  if (filterType === 'max') {
    if (!targetVal) return true
    const num = Number(targetVal)
    return !isNaN(num) ? score <= num : true
  }
  if (filterType === 'range') {
    const minNum = minVal ? Number(minVal) : 0
    const maxNum = maxVal ? Number(maxVal) : 100
    return score >= minNum && score <= maxNum
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

  // Lead Score Filter State
  const [scoreFilterType, setScoreFilterType] = useState<ScoreFilterType>('all')
  const [scoreTarget, setScoreTarget] = useState<string>('70')
  const [scoreMin, setScoreMin] = useState<string>('50')
  const [scoreMax, setScoreMax] = useState<string>('100')

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
          .select('id, name, phone_number, stage, assigned_to, notes, last_message, created_at, updated_at')
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
            last_message: c.last_message || null,
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
    const rows = filteredLeads.map((l) => {
      const scoreObj = getLeadScore(l)
      return {
        Name: l.name || '',
        Phone: l.phone_number || '',
        Company: l.company_name || '',
        Source: l.source || '',
        'Lead Score': scoreObj.score,
        'Lead Quality': scoreObj.label,
        Stage: l.stage || 'new',
        'Follow-up Reminder': l.followup_date || '',
        Notes: l.notes || '',
        'Created At': l.created_at || '',
      }
    })

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

  // Pre-calculated Lead Scores for super-fast filtering
  const leadScores = useMemo(() => {
    const map = new Map<string, number>()
    leads.forEach((l) => {
      const key = l.id || l.conversation_id
      map.set(key, getLeadScoreValue(l))
    })
    return map
  }, [leads])

  // Fast In-Memory Filtered Leads
  const filteredLeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return leads.filter((lead) => {
      const leadKey = lead.id || lead.conversation_id
      const leadScore = leadScores.get(leadKey) ?? getLeadScoreValue(lead)

      // 1. Search filter with lead score support (e.g. "70", "score: 70", "score 70", ">=70", "=70")
      if (q) {
        let matchesScoreSyntax = false
        const scoreSyntaxMatch = q.match(/^(?:score\s*[:=]?\s*|\s*)(>=|<=|>|<|=)?\s*(\d{1,3})$/i)
        if (scoreSyntaxMatch && !isNaN(Number(scoreSyntaxMatch[2]))) {
          const op = scoreSyntaxMatch[1] || '='
          const targetNum = Number(scoreSyntaxMatch[2])
          if (op === '=' || !scoreSyntaxMatch[1]) {
            if (leadScore === targetNum) matchesScoreSyntax = true
          } else if (op === '>=') {
            if (leadScore >= targetNum) matchesScoreSyntax = true
          } else if (op === '>') {
            if (leadScore > targetNum) matchesScoreSyntax = true
          } else if (op === '<=') {
            if (leadScore <= targetNum) matchesScoreSyntax = true
          } else if (op === '<') {
            if (leadScore < targetNum) matchesScoreSyntax = true
          }
        }

        const nameMatch = lead.name?.toLowerCase().includes(q)
        const phoneMatch = lead.phone_number?.toLowerCase().includes(q)
        const companyMatch = lead.company_name?.toLowerCase().includes(q)
        const sourceMatch = lead.source?.toLowerCase().includes(q)
        const notesMatch = lead.notes?.toLowerCase().includes(q)
        const scoreTextMatch = String(leadScore).includes(q)

        if (!matchesScoreSyntax && !nameMatch && !phoneMatch && !companyMatch && !sourceMatch && !notesMatch && !scoreTextMatch) {
          return false
        }
      }

      // 2. Date filter
      if (!matchesDateFilter(lead.created_at, dateFilter, customStartDate, customEndDate)) {
        return false
      }

      // 3. Source filter
      if (sourceFilter !== 'All' && lead.source !== sourceFilter) {
        return false
      }

      // 4. Lead Score filter
      if (!matchesScoreFilter(leadScore, scoreFilterType, scoreTarget, scoreMin, scoreMax)) {
        return false
      }

      // 5. Stage Tab filter
      if (activeStageTab !== 'all') {
        const col = getLeadColumn(lead.stage, lead.created_at)
        if (col !== activeStageTab) return false
      }

      return true
    })
  }, [
    leads,
    leadScores,
    searchQuery,
    dateFilter,
    customStartDate,
    customEndDate,
    sourceFilter,
    scoreFilterType,
    scoreTarget,
    scoreMin,
    scoreMax,
    activeStageTab,
  ])

  // Count calculations for Status Tabs
  const stageCounts = useMemo(() => {
    const dateFiltered = leads.filter((l) => {
      const leadKey = l.id || l.conversation_id
      const leadScore = leadScores.get(leadKey) ?? getLeadScoreValue(l)
      const matchesDate = matchesDateFilter(l.created_at, dateFilter, customStartDate, customEndDate)
      const matchesSource = sourceFilter === 'All' || l.source === sourceFilter
      const matchesScore = matchesScoreFilter(leadScore, scoreFilterType, scoreTarget, scoreMin, scoreMax)
      return matchesDate && matchesSource && matchesScore
    })

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
  }, [leads, leadScores, dateFilter, customStartDate, customEndDate, sourceFilter, scoreFilterType, scoreTarget, scoreMin, scoreMax])

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
  }, [activeStageTab, searchQuery, dateFilter, sourceFilter, scoreFilterType, scoreTarget, scoreMin, scoreMax])

  // Lazy render more items as user scrolls near bottom
  const visibleLeads = useMemo(() => {
    return filteredLeads.slice(0, renderLimit)
  }, [filteredLeads, renderLimit])

  const activeFilterCount =
    (sourceFilter !== 'All' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0) +
    (scoreFilterType !== 'all' ? 1 : 0)

  const handleResetFilters = () => {
    setSourceFilter('All')
    setDateFilter('all')
    setCustomStartDate('')
    setCustomEndDate('')
    setScoreFilterType('all')
    setScoreTarget('70')
    setScoreMin('50')
    setScoreMax('100')
  }

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
              <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 text-gray-800 dark:text-gray-200 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
                    Filter Leads
                  </span>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={handleResetFilters}
                      className="text-[11px] text-purple-600 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset ({activeFilterCount})
                    </button>
                  )}
                </div>

                {/* Lead Score Filter Section */}
                <div className="bg-purple-50/50 dark:bg-purple-950/20 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900/40 space-y-2">
                  <label className="block text-[10px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
                      Lead Score Filter
                    </span>
                    {scoreFilterType !== 'all' && (
                      <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.2 rounded-full font-bold">
                        ACTIVE
                      </span>
                    )}
                  </label>

                  <select
                    value={scoreFilterType}
                    onChange={(e) => setScoreFilterType(e.target.value as ScoreFilterType)}
                    className="w-full p-2 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-950 font-semibold text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600 outline-none"
                  >
                    <option value="all">🎯 All Scores (0 - 100)</option>
                    <option value="high_70">🔥 Score 70+ (High Intent)</option>
                    <option value="exact">🎯 Exact Score (= 70, etc.)</option>
                    <option value="min">📈 Minimum Score (≥)</option>
                    <option value="max">📉 Maximum Score (≤)</option>
                    <option value="range">↔️ Score Range (Min - Max)</option>
                    <option value="hot">🟢 Hot Leads (Score 75 - 100)</option>
                    <option value="warm">🟡 Warm Leads (Score 45 - 74)</option>
                    <option value="cold">⚪ Cold / Fresh (&lt; 45)</option>
                  </select>

                  {(scoreFilterType === 'exact' || scoreFilterType === 'min' || scoreFilterType === 'max') && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                        <span>
                          {scoreFilterType === 'exact'
                            ? 'Target Score'
                            : scoreFilterType === 'min'
                            ? 'Minimum Score (≥)'
                            : 'Maximum Score (≤)'}
                          :
                        </span>
                        <span className="text-purple-600 font-extrabold text-xs">
                          {scoreFilterType === 'exact' ? '=' : scoreFilterType === 'min' ? '≥' : '≤'}{' '}
                          {scoreTarget || 70}/100
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={scoreTarget}
                          onChange={(e) => setScoreTarget(e.target.value)}
                          placeholder="e.g. 70"
                          className="w-full p-2 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-950 font-bold text-xs outline-none focus:ring-2 focus:ring-purple-600"
                        />
                      </div>
                      {/* Quick preset buttons */}
                      <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 font-semibold">Quick:</span>
                        {['30', '50', '60', '70', '80', '90'].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setScoreTarget(num)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                              scoreTarget === num
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-purple-50'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {scoreFilterType === 'range' && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                        <span>Score Range:</span>
                        <span className="text-purple-600 font-extrabold text-xs">
                          {scoreMin || 0} to {scoreMax || 100}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Min</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={scoreMin}
                            onChange={(e) => setScoreMin(e.target.value)}
                            placeholder="Min (e.g. 50)"
                            className="w-full p-1.5 border border-purple-200 dark:border-purple-800 rounded-lg bg-white dark:bg-gray-950 font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Max</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={scoreMax}
                            onChange={(e) => setScoreMax(e.target.value)}
                            placeholder="Max (e.g. 100)"
                            className="w-full p-1.5 border border-purple-200 dark:border-purple-800 rounded-lg bg-white dark:bg-gray-950 font-bold text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Date Range Section */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Date Range
                  </label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 font-semibold text-xs"
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

                {/* Lead Source Section */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Lead Source
                  </label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 font-semibold text-xs"
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
                  className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow-xs text-center transition-colors"
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

      {/* 2. Clean White Search Bar with Quick Score Dropdown */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search leads by name, phone, company, score (e.g. 70, score>=70)..."
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

        {/* 1-Tap Quick Score Filter Pill */}
        <div className="relative shrink-0">
          <select
            value={
              scoreFilterType === 'exact' && scoreTarget === '70'
                ? 'exact_70'
                : scoreFilterType === 'high_70'
                ? 'high_70'
                : scoreFilterType
            }
            onChange={(e) => {
              const val = e.target.value
              if (val === 'exact_70') {
                setScoreFilterType('exact')
                setScoreTarget('70')
              } else if (val === 'high_70') {
                setScoreFilterType('high_70')
                setScoreTarget('70')
              } else {
                setScoreFilterType(val as ScoreFilterType)
              }
            }}
            className={`py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all shadow-2xs cursor-pointer outline-none ${
              scoreFilterType !== 'all'
                ? 'bg-purple-100 dark:bg-purple-950/70 border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-200 ring-2 ring-purple-500/20'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
            }`}
            title="Quick Lead Score Filter"
          >
            <option value="all">🎯 Score: All</option>
            <option value="high_70">🔥 Score: 70+</option>
            <option value="exact_70">🎯 Score: Exact 70</option>
            <option value="hot">🟢 Hot (75+)</option>
            <option value="warm">🟡 Warm (45-74)</option>
            <option value="cold">⚪ Cold (&lt;45)</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips / Badges Bar */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3 px-0.5 animate-in fade-in duration-150">
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Filters:</span>

          {scoreFilterType !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-xs font-semibold shadow-2xs">
              <TrendingUp className="w-3 h-3 text-purple-600" />
              <span>
                Score:{' '}
                {scoreFilterType === 'high_70'
                  ? '≥ 70'
                  : scoreFilterType === 'hot'
                  ? 'Hot (≥ 75)'
                  : scoreFilterType === 'warm'
                  ? 'Warm (45 - 74)'
                  : scoreFilterType === 'cold'
                  ? 'Cold (< 45)'
                  : scoreFilterType === 'exact'
                  ? `= ${scoreTarget || 70}`
                  : scoreFilterType === 'min'
                  ? `≥ ${scoreTarget || 70}`
                  : scoreFilterType === 'max'
                  ? `≤ ${scoreTarget || 70}`
                  : scoreFilterType === 'range'
                  ? `${scoreMin || 0} - ${scoreMax || 100}`
                  : ''}
              </span>
              <button
                onClick={() => setScoreFilterType('all')}
                className="hover:text-purple-900 dark:hover:text-white p-0.5 rounded transition-colors"
                title="Clear score filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {sourceFilter !== 'All' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold shadow-2xs">
              <span>Source: {sourceFilter}</span>
              <button
                onClick={() => setSourceFilter('All')}
                className="hover:text-indigo-900 dark:hover:text-white p-0.5 rounded transition-colors"
                title="Clear source filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {dateFilter !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-lg text-xs font-semibold shadow-2xs">
              <Calendar className="w-3 h-3 text-sky-600" />
              <span>
                Date:{' '}
                {dateFilter === 'today'
                  ? 'Today'
                  : dateFilter === 'yesterday'
                  ? 'Yesterday'
                  : dateFilter === 'this_week'
                  ? 'Last 7 Days'
                  : 'Custom Date'}
              </span>
              <button
                onClick={() => {
                  setDateFilter('all')
                  setCustomStartDate('')
                  setCustomEndDate('')
                }}
                className="hover:text-sky-900 dark:hover:text-white p-0.5 rounded transition-colors"
                title="Clear date filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={handleResetFilters}
            className="text-[11px] text-gray-500 hover:text-purple-600 hover:underline font-semibold ml-1 flex items-center gap-0.5"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Clear All
          </button>
        </div>
      )}

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
