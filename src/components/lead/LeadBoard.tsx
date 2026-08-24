'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LeadColumn from './LeadColumn'
import LeadCard from './LeadCard'
import { Plus, Search, Filter, RefreshCw, X, Check, FileText, Calendar, Sparkles } from 'lucide-react'

const COLUMNS = [
  { id: 'new', title: 'New Leads', subtitle: 'Last 24 Hours', headerBg: 'bg-teal-700', colorClass: 'border-t-teal-700' },
  { id: 'interested', title: 'Interested', subtitle: 'Hot & Interested Leads', headerBg: 'bg-lime-600', colorClass: 'border-t-lime-600' },
  { id: 'processing', title: 'In Process', subtitle: 'Follow-up & Review', headerBg: 'bg-indigo-900', colorClass: 'border-t-indigo-900' },
  { id: 'confirm', title: 'Confirm', subtitle: 'Converted / Closed', headerBg: 'bg-green-800', colorClass: 'border-t-green-800' },
  { id: 'cancel', title: 'Cancel', subtitle: 'Not Interested', headerBg: 'bg-red-600', colorClass: 'border-t-red-600' },
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

type DateFilterType = 'all' | 'today' | 'yesterday' | 'this_week'

function matchesDateFilter(createdAt: string | undefined, filter: DateFilterType): boolean {
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
  return true
}

export default function LeadBoard() {
  const searchParams = useSearchParams()
  const paramFilter = searchParams?.get('filter')

  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilterType>(
    paramFilter === 'today' ? 'today' : paramFilter === 'yesterday' ? 'yesterday' : 'all'
  )
  const [showAddModal, setShowAddModal] = useState(false)

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

  const todayCount = useMemo(() => leads.filter((l) => matchesDateFilter(l.created_at, 'today')).length, [leads])
  const yesterdayCount = useMemo(() => leads.filter((l) => matchesDateFilter(l.created_at, 'yesterday')).length, [leads])
  const thisWeekCount = useMemo(() => leads.filter((l) => matchesDateFilter(l.created_at, 'this_week')).length, [leads])

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!matchesDateFilter(l.created_at, dateFilter)) return false
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.phone_number && l.phone_number.includes(q)) ||
        (l.company_name && l.company_name.toLowerCase().includes(q))
      )
    })
  }, [leads, searchQuery, dateFilter])

  if (loading && leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top Action Sub-bar */}
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
              onClick={() => setDateFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                dateFilter === 'all'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              All ({leads.length})
            </button>
            <button
              onClick={() => setDateFilter('today')}
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
              onClick={() => setDateFilter('yesterday')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                dateFilter === 'yesterday'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Yesterday ({yesterdayCount})
            </button>
            <button
              onClick={() => setDateFilter('this_week')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                dateFilter === 'this_week'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              7 Days ({thisWeekCount})
            </button>
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

      {/* Active Filter Notice Banner */}
      {dateFilter === 'today' && (
        <div className="flex items-center justify-between px-3.5 py-2 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl mb-3 text-xs text-green-800 dark:text-green-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-bold">Filtered by Today's Leads:</span>
            <span>{filteredLeads.length} lead{filteredLeads.length === 1 ? '' : 's'} registered today</span>
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

      {dateFilter !== 'all' && dateFilter !== 'today' && (
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

      {/* 5-Column Kanban Board */}
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
