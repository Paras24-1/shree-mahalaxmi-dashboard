'use client'

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Conversation, Stage } from '@/types'
import { useConversations } from '@/hooks'
import { Search, Filter, Wifi, Trash2, X, UserPlus, Circle, RefreshCw, TrendingUp, SlidersHorizontal, Target } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getLeadScore, getLeadScoreValue, LeadScoreOutput } from '@/lib/leadScoring'

const STAGES: Stage[] = [
  'new',
  'callback_done_by_ai',
  'interested',
  'booking',
  'confirmed',
  'cancelled',
  'completed',
  'followup',
  'not_interested',
  'call_done',
  'low_budget',
  'hot_customer',
  'not_connected',
]

const STAGE_COLORS: Record<Stage, string> = {
  new: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  callback_done_by_ai: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  interested: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  booking: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  followup: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  not_interested: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  call_done: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  low_budget: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  hot_customer: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  not_connected: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
}

interface Props {
  selectedId: string | null
  onSelect: (conv: Conversation) => void
  onDelete?: (id: string) => void
}

interface Employee {
  id: string
  name: string
  email: string
}

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

function formatSimpleTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 0) return 'now'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function ConversationList({ selectedId, onSelect, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [unread, setUnread] = useState(false)
  const [assignedFilter, setAssignedFilter] = useState<string>('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leadsMetadata, setLeadsMetadata] = useState<Map<string, any>>(new Map())

  // Lead Score Filter States
  const [scoreFilterType, setScoreFilterType] = useState<ScoreFilterType>('all')
  const [scoreTarget, setScoreTarget] = useState<string>('70')
  const [scoreMin, setScoreMin] = useState<string>('50')
  const [scoreMax, setScoreMax] = useState<string>('100')
  const [showScoreModal, setShowScoreModal] = useState(false)

  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const { conversations, loading, refetch } = useConversations({
    search,
    stage,
    unread,
    assignFilter: assignedFilter,
    userId: profile?.id,
    isAdmin: !!isAdmin,
    userRole: profile?.role,
  })

  // Fetch leads metadata for comprehensive dynamic lead scoring
  const fetchLeadsMetadata = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('leads')
        .select('id, conversation_id, phone_number, stage, lead_score, lead_quality, machine_interest, callback_ready, conversation_summary')
        .limit(2000)

      if (data) {
        const map = new Map<string, any>()
        data.forEach((l) => {
          if (l.conversation_id) map.set(l.conversation_id, l)
          if (l.id) map.set(l.id, l)
          const cleanPhone = (l.phone_number || '').replace(/\D/g, '')
          if (cleanPhone) {
            map.set(cleanPhone, l)
            if (cleanPhone.length >= 10) map.set(cleanPhone.slice(-10), l)
          }
        })
        setLeadsMetadata(map)
      }
    } catch (err) {
      console.error('Error fetching leads metadata:', err)
    }
  }, [])

  useEffect(() => {
    fetchLeadsMetadata()
  }, [fetchLeadsMetadata])

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([refetch(), fetchLeadsMetadata()])
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  useEffect(() => {
    if (profile?.role === 'admin') {
      supabase
        .from('users')
        .select('id, name, email')
        .eq('role', 'employee')
        .order('name')
        .then(({ data }) => {
          if (data) setEmployees(data)
        })
    }
  }, [profile])

  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>()
    employees.forEach((e) => map.set(e.id, e))
    return map
  }, [employees])

  // Pre-calculated Lead Scores map for instant filtering & rendering
  const leadScoresMap = useMemo(() => {
    const map = new Map<string, LeadScoreOutput>()
    conversations.forEach((conv) => {
      const cleanPhone = (conv.phone_number || '').replace(/\D/g, '')
      const leadMeta =
        leadsMetadata.get(conv.id) ||
        (cleanPhone ? leadsMetadata.get(cleanPhone) || leadsMetadata.get(cleanPhone.slice(-10)) : null)

      const mergedLead = {
        ...conv,
        ...leadMeta,
        stage: conv.stage || leadMeta?.stage || 'new',
        last_message: conv.last_message,
      }
      map.set(conv.id, getLeadScore(mergedLead))
    })
    return map
  }, [conversations, leadsMetadata])

  const sortedConversations = useMemo(() => {
    const q = search.toLowerCase().trim()

    const list = conversations.filter((conv) => {
      const scoreObj = leadScoresMap.get(conv.id)
      const score = scoreObj ? scoreObj.score : getLeadScoreValue(conv)

      // 1. Score filter
      if (scoreFilterType === 'high_70' && score < 70) return false
      if (scoreFilterType === 'hot' && score < 75) return false
      if (scoreFilterType === 'warm' && (score < 45 || score >= 75)) return false
      if (scoreFilterType === 'cold' && score >= 45) return false
      if (scoreFilterType === 'exact') {
        const target = Number(scoreTarget || 70)
        if (!isNaN(target) && score !== target) return false
      }
      if (scoreFilterType === 'min') {
        const target = Number(scoreTarget || 70)
        if (!isNaN(target) && score < target) return false
      }
      if (scoreFilterType === 'max') {
        const target = Number(scoreTarget || 70)
        if (!isNaN(target) && score > target) return false
      }
      if (scoreFilterType === 'range') {
        const minVal = Number(scoreMin || 0)
        const maxVal = Number(scoreMax || 100)
        if (score < minVal || score > maxVal) return false
      }

      // 2. Search box score syntax match (e.g. "score: 70", "70", ">=70", "=70")
      if (q) {
        const scoreSyntaxMatch = q.match(/^(?:score\s*[:=]?\s*|\s*)(>=|<=|>|<|=)?\s*(\d{1,3})$/i)
        if (scoreSyntaxMatch && !isNaN(Number(scoreSyntaxMatch[2]))) {
          const op = scoreSyntaxMatch[1] || '='
          const targetNum = Number(scoreSyntaxMatch[2])
          let matchesSyntax = false
          if (op === '=' || !scoreSyntaxMatch[1]) {
            if (score === targetNum) matchesSyntax = true
          } else if (op === '>=') {
            if (score >= targetNum) matchesSyntax = true
          } else if (op === '>') {
            if (score > targetNum) matchesSyntax = true
          } else if (op === '<=') {
            if (score <= targetNum) matchesSyntax = true
          } else if (op === '<') {
            if (score < targetNum) matchesSyntax = true
          }
          if (matchesSyntax) return true
        }
      }

      return true
    })

    return list.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }, [conversations, leadScoresMap, scoreFilterType, scoreTarget, scoreMin, scoreMax, search])

  // Auto-select first conversation on laptop / Chromebook / desktop
  useEffect(() => {
    if (!selectedId && sortedConversations.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 768) {
      onSelect(sortedConversations[0])
    }
  }, [selectedId, sortedConversations, onSelect])

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setConfirmId(id)
  }

  const confirmDelete = async () => {
    if (!confirmId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/conversations/${confirmId}`, { method: 'DELETE' })
      if (res.ok) {
        onDelete?.(confirmId)
        refetch()
      }
    } finally {
      setDeleting(false)
      setConfirmId(null)
    }
  }

  return (
    <aside className="flex flex-col h-full bg-white dark:bg-gray-950 relative">
      {/* Confirm Delete Modal */}
      {confirmId && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-xs shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Delete Conversation?</h3>
              <button onClick={() => setConfirmId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              This will permanently delete the conversation and all messages.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-red-500 text-white hover:bg-red-600 font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Lead Score Filter Modal */}
      {showScoreModal && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-xs shadow-2xl border border-gray-200 dark:border-gray-800 space-y-3.5 text-xs text-gray-800 dark:text-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span>Lead Score Filter</span>
              </div>
              <button onClick={() => setShowScoreModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Filter Mode
              </label>
              <select
                value={scoreFilterType === 'all' ? 'high_70' : scoreFilterType}
                onChange={(e) => setScoreFilterType(e.target.value as ScoreFilterType)}
                className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 font-bold text-xs outline-none"
              >
                <option value="high_70">🔥 High Score (≥ 70)</option>
                <option value="exact">🎯 Exact Score (=)</option>
                <option value="min">📈 Minimum Score (≥)</option>
                <option value="max">📉 Maximum Score (≤)</option>
                <option value="range">📊 Score Range (Min - Max)</option>
                <option value="hot">🟢 Hot Leads (≥ 75)</option>
                <option value="warm">🟡 Warm Leads (45 - 74)</option>
                <option value="cold">⚪ Cold Leads (&lt; 45)</option>
              </select>
            </div>

            {['exact', 'min', 'max'].includes(scoreFilterType) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>Target Score:</span>
                  <span className="text-purple-600 font-extrabold">{scoreTarget || 70}/100</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreTarget}
                  onChange={(e) => setScoreTarget(e.target.value)}
                  placeholder="e.g. 70"
                  className="w-full p-2 border border-purple-200 dark:border-purple-800 rounded-xl bg-white dark:bg-gray-950 font-bold text-xs outline-none focus:ring-2 focus:ring-purple-600"
                />
                <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-400 font-semibold">Quick:</span>
                  {['30', '50', '60', '70', '80', '90'].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setScoreTarget(num)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                        scoreTarget === num
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
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
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>Score Range:</span>
                  <span className="text-purple-600 font-extrabold">{scoreMin || 0} to {scoreMax || 100}</span>
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
                      className="w-full p-1.5 border border-purple-200 dark:border-purple-800 rounded-lg bg-white dark:bg-gray-950 font-bold text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setScoreFilterType('all')
                  setShowScoreModal(false)
                }}
                className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowScoreModal(false)}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-2xs transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <h1 className="text-base font-bold text-gray-900 dark:text-white">
            {isAdmin ? 'All Conversations' : 'My Chats'}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              title="Refresh conversations"
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <Wifi className="w-3 h-3 animate-pulse" /> Live
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, or score (e.g. 70, score>=70)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {isAdmin && employees.length > 0 && (
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none font-medium"
            >
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">Assigned</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none font-medium"
          >
            <option value="">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          {/* Lead Score Quick Filter Dropdown */}
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
              } else if (val === 'custom_modal') {
                setShowScoreModal(true)
              } else {
                setScoreFilterType(val as ScoreFilterType)
              }
            }}
            className={`text-[11px] px-2 py-1 rounded-lg focus:outline-none transition-colors font-semibold ${
              scoreFilterType !== 'all'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 ring-1 ring-purple-500'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}
            title="Filter by Lead Score"
          >
            <option value="all">🎯 Score: All</option>
            <option value="high_70">🔥 Score: 70+</option>
            <option value="exact_70">🎯 Score: Exact 70</option>
            <option value="hot">🟢 Hot (≥ 75)</option>
            <option value="warm">🟡 Warm (45-74)</option>
            <option value="cold">⚪ Cold (&lt; 45)</option>
            <option value="custom_modal">⚙️ Custom Score...</option>
          </select>

          <button
            onClick={() => setUnread((u) => !u)}
            className={`text-[11px] px-2 py-1 rounded-lg transition-colors font-medium ${
              unread
                ? 'bg-emerald-500 text-white font-bold'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            Unread
          </button>
        </div>

        {/* Active Score Filter Chip */}
        {scoreFilterType !== 'all' && (
          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-gray-100 dark:border-gray-800">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-md text-[10px] font-bold">
              <TrendingUp className="w-2.5 h-2.5 text-purple-600" />
              <span>
                Score:{' '}
                {scoreFilterType === 'high_70'
                  ? '≥ 70'
                  : scoreFilterType === 'hot'
                  ? 'Hot (≥ 75)'
                  : scoreFilterType === 'warm'
                  ? 'Warm (45-74)'
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
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-900">
        {loading && sortedConversations.length === 0 ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-1/2" />
                  <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-xs text-center px-4">
            <Filter className="w-5 h-5 mb-1 opacity-40 text-purple-500" />
            <span>No conversations matching filters</span>
            {(scoreFilterType !== 'all' || stage || search || unread) && (
              <button
                onClick={() => {
                  setScoreFilterType('all')
                  setStage('')
                  setSearch('')
                  setUnread(false)
                }}
                className="mt-1 text-[11px] text-purple-600 font-bold hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          sortedConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedId}
              onClick={() => onSelect(conv)}
              onDelete={(e) => handleDelete(e, conv.id)}
              isAdmin={!!isAdmin}
              assignedEmployee={conv.assigned_to ? employeeMap.get(conv.assigned_to) : undefined}
              leadScore={leadScoresMap.get(conv.id) || getLeadScore(conv)}
              onAssignmentChange={refetch}
            />
          ))
        )}
      </div>
    </aside>
  )
}

const ConversationItem = memo(function ConversationItem({
  conversation: conv,
  isSelected,
  onClick,
  onDelete,
  isAdmin,
  assignedEmployee,
  leadScore,
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  isAdmin: boolean
  assignedEmployee?: Employee
  leadScore: LeadScoreOutput
  onAssignmentChange: () => void
}) {
  const initials = (conv.name || conv.phone_number || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const timeAgo = formatSimpleTime(conv.updated_at)

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500'
          : 'hover:bg-gray-50 dark:hover:bg-gray-900/60'
      }`}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-2xs">
          {initials}
        </div>
        {!conv.ai_mode && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-orange-500 border-2 border-white dark:border-gray-950" />
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={`text-xs font-bold truncate ${
              isSelected ? 'text-emerald-800 dark:text-emerald-300' : 'text-gray-900 dark:text-white'
            }`}
          >
            {conv.name || conv.phone_number}
          </span>
          <span className="text-[10px] text-gray-400 shrink-0 ml-1 font-mono">{timeAgo}</span>
        </div>

        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mb-1">
          {conv.last_message || 'No messages yet'}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Stage Badge */}
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tight ${
              STAGE_COLORS[conv.stage as Stage] || STAGE_COLORS.new
            }`}
          >
            {conv.stage.replace(/_/g, ' ')}
          </span>

          {/* Dynamic Lead Score Badge */}
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 border ${
              leadScore.score >= 75
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                : leadScore.score >= 45
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
            }`}
            title={`Lead Score: ${leadScore.score}/100 (${leadScore.label})`}
          >
            <TrendingUp className="w-2.5 h-2.5 shrink-0" />
            <span>{leadScore.score}</span>
          </span>

          {assignedEmployee && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {assignedEmployee.name.split(' ')[0]}
            </span>
          )}

          {conv.unread_count > 0 && (
            <span className="ml-auto w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>

      {isAdmin && (
        <button
          onClick={onDelete}
          className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 hover:opacity-100 transition-opacity"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
})
