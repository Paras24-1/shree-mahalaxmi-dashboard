'use client'

import { useState, useEffect } from 'react'
import { Conversation, Stage } from '@/types'
import { useConversations } from '@/hooks'
import { formatDistanceToNow } from 'date-fns'
import { Search, Filter, Wifi, Trash2, X, UserPlus } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const STAGES: Stage[] = ['new', 'interested', 'booking', 'confirmed', 'cancelled', 'completed', 'followup', 'not_interested', 'call_done', 'low_budget', 'hot_customer', 'not_connected']

const STAGE_COLORS: Record<Stage, string> = {
  new:        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  interested: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  booking:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  confirmed:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  cancelled:  'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  completed:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  followup:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  not_interested:'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    call_done:      'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  low_budget:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
hot_customer:'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
not_connected:  'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
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

export default function ConversationList({ selectedId, onSelect, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [unread, setUnread] = useState(false)
  const [assignedFilter, setAssignedFilter] = useState<string>('all') // all, unassigned, assigned, or employee_id
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  console.log('DEBUG:', { profile, isAdmin, role: profile?.role })



  const { conversations, loading, refetch } = useConversations({ 
  search, 
  stage, 
  unread,
  assignFilter: assignedFilter,
  userId: profile?.id,
  isAdmin: !!isAdmin,
  userRole: profile?.role,
})

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchEmployees()
    }
  }, [profile])

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'employee')
      .order('name')
    
    if (data) setEmployees(data)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
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
              This will permanently delete the conversation and all messages. This cannot be undone.
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
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 font-medium"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
  <div>
    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
      {isAdmin ? 'All Conversations' : 'My Chats'}
    </h1>
    {!isAdmin && profile?.name && (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        👤 {profile.name}
      </p>
    )}
  </div>
  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
    <Wifi className="w-3 h-3" />
    Live
  </span>
</div>

        <div className="relative mb-2">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          
          {/* Assignment Filter (Admin only) */}
          {isAdmin && (
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="all">All chats</option>
              <option value="unassigned">Unassigned</option>
              <option value="assigned">All Assigned</option>
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
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
          >
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          
          <button
            onClick={() => setUnread((u) => !u)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${
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
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingSkeleton />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
            <span>No conversations found</span>
          </div>
        ) : (
          [...conversations]
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedId}
                onClick={() => onSelect(conv)}
                onDelete={(e) => handleDelete(e, conv.id)}
                isAdmin={isAdmin}
                employees={employees}
                onAssignmentChange={refetch}
              />
            ))
        )}
      </div>
    </aside>
  )
}

function ConversationItem({
  conversation: conv,
  isSelected,
  onClick,
  onDelete,
  isAdmin,
  employees,
  onAssignmentChange,
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent) => void
  isAdmin: boolean
  employees: Employee[]
  onAssignmentChange: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const initials = (conv.name || conv.phone_number || 'U')
  .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  const timeAgo = formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })

  const assignedEmployee = employees.find(e => e.id === conv.assigned_to)

  const handleAssign = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation()
    setAssigning(true)
    
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conv.id,
          assigned_to: userId
        })
      })

      if (res.ok) {
        onAssignmentChange()
        setShowAssign(false)
      }
    } catch (err) {
      console.error('Assignment failed:', err)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div
      className={`relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-900 ${
        isSelected
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-l-emerald-500'
          : 'hover:bg-gray-50 dark:hover:bg-gray-900'
      }`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
          {initials}
        </div>
        {!conv.ai_mode && (
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange-400 border-2 border-white dark:border-gray-950" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-sm font-medium truncate ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-900 dark:text-white'}`}>
            {conv.name}
          </span>
          <span className="text-xs text-gray-400 shrink-0 ml-2">{timeAgo}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-1">
          {conv.phone_number}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {conv.last_message || 'No messages yet'}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STAGE_COLORS[conv.stage as Stage] || STAGE_COLORS.new}`}>
            {conv.stage}
          </span>
          
          {/* Assignment Badge */}
          {assignedEmployee && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
              → {assignedEmployee.name.split(' ')[0]}
            </span>
          )}
          {!assignedEmployee && isAdmin && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              Unassigned
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {hovered && (
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && !showAssign && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAssign(true); }}
              className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 hover:bg-blue-100 transition-colors"
              title="Assign to employee"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="Delete conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Unread badge */}
      {conv.unread_count > 0 && !hovered && (
        <span className="shrink-0 min-w-[20px] h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
          {conv.unread_count > 99 ? '99+' : conv.unread_count}
        </span>
      )}

      {/* Assignment Dropdown */}
      {showAssign && (
        <div className="absolute right-2 top-2 z-10 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2 min-w-[160px]">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 px-2">Assign to:</p>
          {employees.map((emp) => (
            <button
              key={emp.id}
              onClick={(e) => handleAssign(e, emp.id)}
              disabled={assigning}
              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              {emp.name}
            </button>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); setShowAssign(false); }}
            className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b border-gray-50 dark:border-gray-900">
          <div className="w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-3/4" />
            <div className="h-2.5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-full" />
            <div className="h-2.5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-1/2" />
          </div>
        </div>
      ))}
    </>
  )
}
