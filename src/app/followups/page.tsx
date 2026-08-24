'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Phone,
  MessageCircle,
  Clock,
  Calendar,
  Check,
  RefreshCw,
  Search,
  Bot,
  AlertCircle,
  Filter,
  TrendingUp,
  MoreVertical,
  X,
  FileText,
  Sparkles,
  ChevronLeft,
} from 'lucide-react'

export default function FollowupsPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <FollowupsContent />
      </Suspense>
    </DashboardLayout>
  )
}

function FollowupsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFilter = searchParams?.get('filter') || 'all'

  const [followups, setFollowups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<string>(initialFilter)

  // Reschedule Modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [newDate, setNewDate] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Voice AI trigger state
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  // Fetch unified follow-up leads
  const fetchFollowups = async () => {
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
          .select('id, name, phone_number, stage, assigned_to, created_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(2000),
        supabase.from('users').select('id, name, email').limit(200),
      ])

      const empMap = new Map<string, string>()
      if (usersRes.data) {
        usersRes.data.forEach((u) => {
          if (u.id) empMap.set(u.id, u.name || u.email || 'Team Member')
        })
      }

      const map = new Map<string, any>()

      // 1. Process conversations
      if (convsRes.data) {
        convsRes.data.forEach((c) => {
          map.set(c.id, {
            id: c.id,
            conversation_id: c.id,
            name: c.name || (c.phone_number ? `Lead ${c.phone_number.slice(-4)}` : 'Customer'),
            phone_number: c.phone_number,
            stage: c.stage || 'new',
            assigned_to: c.assigned_to,
            assigned_to_name: c.assigned_to ? empMap.get(c.assigned_to) || 'Priyanka Kamble' : 'Priyanka Kamble',
            created_at: c.created_at || c.updated_at,
          })
        })
      }

      // 2. Merge leads
      if (leadsRes.data) {
        leadsRes.data.forEach((l) => {
          const key = l.conversation_id || l.id
          const existing = map.get(key)
          map.set(key, {
            ...existing,
            ...l,
            id: l.id || existing?.id,
            conversation_id: l.conversation_id || existing?.conversation_id || l.id,
            name: l.name || existing?.name || (l.phone_number ? `Lead ${l.phone_number.slice(-4)}` : 'Customer'),
            phone_number: l.phone_number || existing?.phone_number,
            stage: l.stage || existing?.stage || 'new',
            followup_date: l.followup_date || existing?.followup_date || null,
            followup_notes: l.followup_notes || existing?.followup_notes || null,
            followup_notified: l.followup_notified || false,
            assigned_to: l.assigned_to || existing?.assigned_to,
            assigned_to_name:
              (l.assigned_to && empMap.get(l.assigned_to)) ||
              existing?.assigned_to_name ||
              'Priyanka Kamble',
            created_at: l.created_at || existing?.created_at,
          })
        })
      }

      const allLeads = Array.from(map.values())

      const isFollowupStage = (stage: string) =>
        ['processing', 'in_process', 'followup', 'callback_done_by_ai', 'call_done', 'not_connected'].includes(
          (stage || '').toLowerCase().trim()
        )

      // Filter all leads that belong to follow-ups:
      // Either has a scheduled followup_date OR is in processing/callback stage
      const followupLeads = allLeads.filter((l) => Boolean(l.followup_date) || isFollowupStage(l.stage))

      // Sort by scheduled follow-up date (if any) or creation date
      followupLeads.sort((a, b) => {
        if (a.followup_date && b.followup_date) {
          return new Date(a.followup_date).getTime() - new Date(b.followup_date).getTime()
        }
        if (a.followup_date) return -1
        if (b.followup_date) return 1
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      })

      setFollowups(followupLeads)
    } catch (err) {
      console.error('Error fetching follow-ups:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFollowups()

    const channel = supabase
      .channel(`followups-realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchFollowups())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchFollowups())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Trigger Voice AI Call
  const handleTriggerAI = async (lead: any) => {
    if (!lead.phone_number) return
    const leadId = lead.id || lead.conversation_id
    setTriggeringId(leadId)
    try {
      const res = await fetch('/api/calls/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: lead.phone_number,
          name: lead.name,
          lead_id: lead.id,
          conversation_id: lead.conversation_id,
          notes: lead.followup_notes || 'Triggered from Follow-up section',
        }),
      })

      if (res.ok) {
        setSuccessId(leadId)
        setTimeout(() => setSuccessId(null), 3000)
      } else {
        alert('Could not initiate Voice AI call')
      }
    } catch {
      alert('Failed to connect to Voice AI server')
    } finally {
      setTriggeringId(null)
    }
  }

  // Completing state for green tick button
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set())

  // Mark Follow-up Completed
  const handleMarkComplete = async (lead: any) => {
    const targetId = lead.id || lead.conversation_id
    if (!targetId) return

    setCompletingIds((prev) => new Set(prev).add(targetId))
    try {
      // 1. Update database via server API
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          conversation_id: lead.conversation_id,
          stage: 'confirm',
          followup_date: null,
          followup_notes: null,
          followup_notified: true,
        }),
      })

      if (res.ok) {
        // 2. Immediately remove completed lead from active follow-up list
        setFollowups((prev) =>
          prev.filter((l) => l.id !== targetId && l.conversation_id !== targetId)
        )
      } else {
        alert('Failed to complete follow-up')
      }
    } catch (err) {
      console.error('Failed to complete follow-up:', err)
      alert('Error updating follow-up status')
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    }
  }

  // Reschedule Follow-up
  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead) return
    setSaving(true)
    const targetId = selectedLead.id || selectedLead.conversation_id
    try {
      const updates = {
        followup_date: newDate || null,
        followup_notes: newNotes || null,
        followup_notified: false,
      }

      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLead.id,
          conversation_id: selectedLead.conversation_id,
          ...updates,
        }),
      })

      if (res.ok) {
        setFollowups((prev) =>
          prev.map((l) =>
            l.id === targetId || l.conversation_id === targetId ? { ...l, ...updates } : l
          )
        )
        setShowRescheduleModal(false)
      } else {
        alert('Failed to reschedule follow-up')
      }
    } catch (err) {
      console.error('Failed to reschedule:', err)
      alert('Failed to update follow-up')
    } finally {
      setSaving(false)
    }
  }

  // Categorize Followups strictly by scheduled date
  const categorized = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()

    let todayList: any[] = []
    let overdueList: any[] = []
    let upcomingList: any[] = []
    let scheduledList: any[] = []
    let processingList: any[] = []

    followups.forEach((f) => {
      const isProcessing = ['processing', 'in_process', 'followup', 'callback_done_by_ai', 'call_done', 'not_connected'].includes(
        (f.stage || '').toLowerCase().trim()
      )

      if (f.followup_date) {
        scheduledList.push(f)
        const time = new Date(f.followup_date).getTime()
        if (time < startOfToday) {
          overdueList.push(f)
        } else if (time >= startOfToday && time <= endOfToday) {
          todayList.push(f)
        } else if (time > endOfToday) {
          upcomingList.push(f)
        }
      } else if (isProcessing) {
        processingList.push(f)
        const createdTime = new Date(f.created_at || f.updated_at || 0).getTime()
        if (createdTime >= startOfToday) {
          todayList.push(f)
        }
      }
    })

    return {
      all: followups,
      today: todayList,
      scheduled: scheduledList,
      processing: processingList,
      overdue: overdueList,
      upcoming: upcomingList,
    }
  }, [followups])

  // Filter by Active Tab & Search
  const filteredList = useMemo(() => {
    let baseList = categorized.all
    if (activeTab === 'today') baseList = categorized.today
    else if (activeTab === 'scheduled') baseList = categorized.scheduled
    else if (activeTab === 'processing') baseList = categorized.processing
    else if (activeTab === 'overdue') baseList = categorized.overdue
    else if (activeTab === 'upcoming') baseList = categorized.upcoming

    if (!searchQuery.trim()) return baseList
    const q = searchQuery.toLowerCase().trim()
    return baseList.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.phone_number?.toLowerCase().includes(q) ||
        l.followup_notes?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q)
    )
  }, [categorized, activeTab, searchQuery])

  const TABS = [
    { id: 'today', label: "Today's Follow-ups", count: categorized.today.length, color: 'text-red-600' },
    { id: 'all', label: 'All Follow-ups', count: categorized.all.length, color: 'text-gray-700' },
    { id: 'scheduled', label: 'Scheduled Reminders', count: categorized.scheduled.length, color: 'text-purple-600' },
    { id: 'processing', label: 'In Process Pipeline', count: categorized.processing.length, color: 'text-indigo-600' },
    { id: 'overdue', label: 'Overdue', count: categorized.overdue.length, color: 'text-amber-600' },
    { id: 'upcoming', label: 'Upcoming', count: categorized.upcoming.length, color: 'text-blue-600' },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden max-w-7xl mx-auto w-full">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-800 text-white px-4 py-3.5 rounded-2xl shadow-md flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => router.push('/')}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <span>Follow-ups & Callbacks</span>
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-semibold">
                {categorized.all.length} Leads
              </span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchFollowups}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white text-xs font-semibold flex items-center gap-1"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Search Bar */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search follow-ups by lead name, phone number, or notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-red-500 font-medium transition-all"
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

      {/* 3. Horizontal Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-3.5">
        {TABS.map((tab) => {
          const isSelected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border flex items-center gap-2
                ${
                  isSelected
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 shadow-xs'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }
              `}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isSelected ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 4. Follow-up Cards List */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-12 pr-0.5">
        {loading && followups.length === 0 ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-red-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-semibold">Loading follow-ups...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-20 text-center text-gray-400 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30 text-red-500" />
            <h3 className="font-bold text-gray-700 dark:text-gray-300 text-sm">No follow-ups found in this view</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              You can schedule reminders directly from any lead in the Leads section or Chat window.
            </p>
            <button
              onClick={() => {
                setActiveTab('all')
                setSearchQuery('')
              }}
              className="mt-3 text-xs text-red-600 font-bold hover:underline"
            >
              View all follow-up leads
            </button>
          </div>
        ) : (
          filteredList.map((lead) => {
            const rawPhone = (lead.phone_number || '').replace(/\D/g, '')
            const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone
            const leadId = lead.id || lead.conversation_id
            const isAICalling = triggeringId === leadId
            const isAISuccess = successId === leadId

            return (
              <div
                key={leadId}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1.5 before:bg-red-500 before:rounded-r-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pl-2">
                  {/* Left Contact Details */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-rose-800 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                      {(lead.name || 'L')[0]?.toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {lead.name || 'Customer Lead'}
                        </h3>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/40">
                          {lead.stage === 'callback_done_by_ai' ? 'AI Callback Done' : lead.stage || 'In Process'}
                        </span>
                      </div>

                      {lead.phone_number && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-xs font-semibold text-gray-600 dark:text-gray-300">
                            {lead.phone_number}
                          </span>

                          <a
                            href={`tel:${lead.phone_number.replace(/\s+/g, '')}`}
                            className="p-1 text-sky-600 hover:bg-sky-50 rounded"
                            title="Call Phone"
                          >
                            <Phone className="w-3.5 h-3.5 fill-current" />
                          </a>

                          <a
                            href={`https://wa.me/${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="WhatsApp Chat"
                          >
                            <MessageCircle className="w-3.5 h-3.5 fill-emerald-100" />
                          </a>
                        </div>
                      )}

                      {/* Reminder / Scheduled Date */}
                      <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <Clock className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <span>
                          {lead.followup_date
                            ? `Scheduled: ${new Date(lead.followup_date).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}`
                            : 'Follow-up pipeline (Ready for callback)'}
                        </span>
                      </div>

                      {/* Notes / Reason */}
                      {lead.followup_notes && (
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 bg-red-50/50 dark:bg-red-950/20 p-2 rounded-xl border border-red-100 dark:border-red-900/30">
                          <strong>Reason: </strong>
                          <span>{lead.followup_notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0 sm:self-center pl-2 sm:pl-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100 dark:border-gray-800">
                    {/* Voice AI Trigger Button */}
                    <button
                      type="button"
                      onClick={() => handleTriggerAI(lead)}
                      disabled={isAICalling}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                        isAISuccess
                          ? 'bg-emerald-600 text-white'
                          : isAICalling
                          ? 'bg-purple-700 text-white animate-pulse'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                      title="Trigger Voice AI automated call"
                    >
                      <Bot className="w-4 h-4" />
                      <span>{isAISuccess ? 'AI Call Started!' : isAICalling ? 'Calling...' : 'Voice AI Call'}</span>
                    </button>

                    {/* Reschedule Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLead(lead)
                        setNewDate(lead.followup_date || '')
                        setNewNotes(lead.followup_notes || '')
                        setShowRescheduleModal(true)
                      }}
                      className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold transition-colors flex items-center gap-1"
                      title="Reschedule Reminder"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Reschedule</span>
                    </button>

                    {/* Mark Done Button */}
                    <button
                      type="button"
                      onClick={() => handleMarkComplete(lead)}
                      disabled={completingIds.has(leadId)}
                      className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                        completingIds.has(leadId)
                          ? 'bg-emerald-600 text-white cursor-wait'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 dark:border-emerald-800'
                      }`}
                      title="Mark Follow-up as Completed"
                    >
                      {completingIds.has(leadId) ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </button>

                    {/* Open Chat */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetId = lead.conversation_id || lead.id || ''
                        const phone = lead.phone_number ? encodeURIComponent(lead.phone_number) : ''
                        router.push(`/chat?conversation_id=${targetId}&phone=${phone}`)
                      }}
                      className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 dark:border-indigo-800 transition-colors"
                      title="Open WhatsApp Chat"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Reschedule Follow-up Modal */}
      {showRescheduleModal && selectedLead && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white text-sm">
                <Clock className="w-4 h-4 text-red-500" />
                <span>Reschedule Follow-up: {selectedLead.name}</span>
              </div>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReschedule} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                  Follow-up Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                  Follow-up Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Call regarding quotation and machine demo"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
