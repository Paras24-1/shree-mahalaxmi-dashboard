'use client'

import React, { useState, useEffect, useMemo, memo } from 'react'
import { Conversation, Stage } from '@/types'
import { useConversations } from '@/hooks'
import { Search, Filter, Wifi, Trash2, X, UserPlus, Circle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

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

  const handleManualRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
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

  const sortedConversations = useMemo(() => {
    return [...conversations].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
  }, [conversations])

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
    <aside className="flex flex-col h-full bg-white dark:bg-gray-950">
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
            placeholder="Search name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {isAdmin && employees.length > 0 && (
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
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
            className="text-[11px] px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <button
            onClick={() => setUnread((u) => !u)}
            className={`text-[11px] px-2 py-0.5 rounded-lg transition-colors font-medium ${
              unread
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            Unread
          </button>
        </div>
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
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-xs">
            <span>No conversations found</span>
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
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  isAdmin: boolean
  assignedEmployee?: Employee
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
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tight ${
              STAGE_COLORS[conv.stage as Stage] || STAGE_COLORS.new
            }`}
          >
            {conv.stage.replace(/_/g, ' ')}
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
