'use client'

import React, { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Plus, Search, Trash2, Edit2, X, Check, RefreshCw,
  ListTodo, Calendar, AlertCircle, ArrowUp, Minus, ArrowDown,
  Repeat, ClipboardX, CheckCircle2, Circle, Filter, FileText
} from 'lucide-react'

type TodoPriority = 'high' | 'medium' | 'low'
type TodoStatus = 'pending' | 'completed'
type TabType = 'all' | 'today' | 'pending' | 'recursive'

interface Todo {
  id: string
  title: string
  priority: TodoPriority
  status: TodoStatus
  due_date?: string
  is_recurring?: boolean
  recurrence_interval?: string
  created_at: string
}

// ─── Priority Column Config ──────────────────────────────────────────────────

const PRIORITY_COLUMNS: {
  key: TodoPriority
  label: string
  headerBg: string
  headerText: string
  badgeBg: string
  icon: React.ElementType
}[] = [
  {
    key: 'high',
    label: 'High Priority',
    headerBg: 'bg-red-100/70 dark:bg-red-950/40 border-b-2 border-red-500',
    headerText: 'text-red-600 dark:text-red-400',
    badgeBg: 'text-red-600 dark:text-red-400 font-bold',
    icon: ArrowUp,
  },
  {
    key: 'medium',
    label: 'Medium Priority',
    headerBg: 'bg-amber-100/70 dark:bg-amber-950/40 border-b-2 border-amber-500',
    headerText: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'text-amber-600 dark:text-amber-400 font-bold',
    icon: Minus,
  },
  {
    key: 'low',
    label: 'Low Priority',
    headerBg: 'bg-emerald-100/70 dark:bg-emerald-950/40 border-b-2 border-emerald-500',
    headerText: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'text-emerald-600 dark:text-emerald-400 font-bold',
    icon: ArrowDown,
  },
]

function isTodayDate(dateStr?: string, createdStr?: string): boolean {
  const target = dateStr ? new Date(dateStr) : (createdStr ? new Date(createdStr) : null)
  if (!target || isNaN(target.getTime())) return false
  const now = new Date()
  return (
    target.getDate() === now.getDate() &&
    target.getMonth() === now.getMonth() &&
    target.getFullYear() === now.getFullYear()
  )
}

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TodoPage() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('today')
  const [searchQuery, setSearchQuery] = useState('')
  const [showReports, setShowReports] = useState(false)

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [modalTitle, setModalTitle] = useState('')
  const [modalPriority, setModalPriority] = useState<TodoPriority>('medium')
  const [modalDueDate, setModalDueDate] = useState('')
  const [modalIsRecurring, setModalIsRecurring] = useState(false)
  const [modalRecurrence, setModalRecurrence] = useState('daily')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/todos')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Todo[] = await res.json()
      setTodos(data)
    } catch (err) {
      console.error('Error fetching todos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTodos()
  }, [fetchTodos])

  // ── Modal Actions ──────────────────────────────────────────────────────────

  const openAddModal = (defaultPriority: TodoPriority = 'medium') => {
    setEditingTodo(null)
    setModalTitle('')
    setModalPriority(defaultPriority)
    setModalDueDate(new Date().toISOString().split('T')[0])
    setModalIsRecurring(activeTab === 'recursive')
    setModalRecurrence('daily')
    setShowModal(true)
  }

  const openEditModal = (todo: Todo) => {
    setEditingTodo(todo)
    setModalTitle(todo.title)
    setModalPriority(todo.priority)
    setModalDueDate(todo.due_date ? todo.due_date.split('T')[0] : new Date().toISOString().split('T')[0])
    setModalIsRecurring(!!todo.is_recurring)
    setModalRecurrence(todo.recurrence_interval || 'daily')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!modalTitle.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: modalTitle.trim(),
        priority: modalPriority,
        due_date: modalDueDate || new Date().toISOString().split('T')[0],
        is_recurring: modalIsRecurring,
        recurrence_interval: modalIsRecurring ? modalRecurrence : 'none',
      }

      if (editingTodo) {
        const res = await fetch('/api/todos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTodo.id, ...payload }),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        const res = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
      }
      setShowModal(false)
      await fetchTodos()
    } catch (err) {
      console.error('Error saving todo:', err)
      alert('Failed to save todo. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this todo?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/todos?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setTodos((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error('Error deleting todo:', err)
      alert('Failed to delete todo.')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleStatus = async (todo: Todo) => {
    const nextStatus: TodoStatus = todo.status === 'completed' ? 'pending' : 'completed'
    try {
      const res = await fetch('/api/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: todo.id, status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, status: nextStatus } : t))
      )
    } catch (err) {
      console.error('Error toggling status:', err)
    }
  }

  // ── Tab Filtering ──────────────────────────────────────────────────────────

  const filterByTab = (t: Todo) => {
    if (activeTab === 'today') {
      return isTodayDate(t.due_date, t.created_at)
    }
    if (activeTab === 'pending') {
      return t.status === 'pending'
    }
    if (activeTab === 'recursive') {
      return !!t.is_recurring || (t.recurrence_interval && t.recurrence_interval !== 'none')
    }
    return true // 'all'
  }

  const visibleTodos = todos
    .filter(filterByTab)
    .filter((t) => t.title.toLowerCase().includes(searchQuery.toLowerCase()))

  const getPriorityTodos = (priority: TodoPriority) =>
    visibleTodos.filter((t) => t.priority === priority)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Todo</h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search todos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-7 py-2 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Reports Dropdown button */}
          <div className="relative">
            <button
              onClick={() => setShowReports((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span>Reports</span>
            </button>

            {showReports && (
              <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-3 z-30 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total Todos:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{todos.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Pending:</span>
                  <span className="font-bold text-amber-600">{todos.filter((t) => t.status === 'pending').length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Completed:</span>
                  <span className="font-bold text-emerald-600">{todos.filter((t) => t.status === 'completed').length}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Recurring:</span>
                  <span className="font-bold text-purple-600">{todos.filter((t) => t.is_recurring).length}</span>
                </div>
              </div>
            )}
          </div>

          {/* Add To-Do Button */}
          <button
            onClick={() => openAddModal('medium')}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-900 via-indigo-800 to-pink-600 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add To-Do</span>
          </button>
        </div>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-6 border-b border-gray-200 dark:border-gray-800 mb-6 px-1 overflow-x-auto">
        {[
          { key: 'all' as TabType, label: 'All Todo', icon: ListTodo },
          { key: 'today' as TabType, label: "Today's Todo", icon: Calendar },
          { key: 'pending' as TabType, label: 'Pending Todo', icon: AlertCircle },
          { key: 'recursive' as TabType, label: 'Recursive Todo', icon: Repeat },
        ].map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 py-3 text-sm font-semibold whitespace-nowrap transition-all relative ${
                isActive
                  ? 'text-blue-900 dark:text-blue-400 font-bold'
                  : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-blue-900 dark:text-blue-400' : 'text-gray-400'}`} />
              <span>{label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Priority Columns (High, Medium, Low) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-3" />
          <p className="text-sm text-gray-500">Loading todos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PRIORITY_COLUMNS.map((col) => {
            const colTodos = getPriorityTodos(col.key)
            const Icon = col.icon

            return (
              <div
                key={col.key}
                className="bg-gray-50/70 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-[460px] shadow-sm"
              >
                {/* Column Header */}
                <div className={`p-3.5 flex items-center justify-between ${col.headerBg}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center bg-white/70 dark:bg-gray-900/70 shadow-2xs">
                      <Icon className={`w-3.5 h-3.5 ${col.headerText}`} />
                    </div>
                    <span className={`text-xs font-bold ${col.headerText}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs ${col.badgeBg}`}>({colTodos.length})</span>
                </div>

                {/* Column Content */}
                <div className="p-3.5 flex-1 flex flex-col gap-2.5">
                  {colTodos.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-300 dark:text-gray-600">
                        <ClipboardX className="w-7 h-7" />
                      </div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                        There Are No ToDos to Display
                      </p>
                      <button
                        onClick={() => openAddModal(col.key)}
                        className="mt-3 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add {col.label.split(' ')[0]} Todo
                      </button>
                    </div>
                  ) : (
                    colTodos.map((todo) => {
                      const isDone = todo.status === 'completed'
                      const isDeleting = deletingId === todo.id

                      return (
                        <div
                          key={todo.id}
                          className={`p-3 rounded-xl border transition-all duration-200 bg-white dark:bg-gray-850 shadow-2xs group flex items-start justify-between gap-2.5 ${
                            isDone
                              ? 'border-gray-200/60 dark:border-gray-800 opacity-60'
                              : 'border-gray-200 dark:border-gray-750 hover:border-gray-300 dark:hover:border-gray-650 hover:shadow-sm'
                          }`}
                        >
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleStatus(todo)}
                            className="mt-0.5 shrink-0 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title={isDone ? 'Mark as pending' : 'Mark as completed'}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>

                          {/* Details */}
                          <div className="flex-1 min-w-0">
                            <h4
                              className={`text-xs font-semibold leading-snug break-words ${
                                isDone
                                  ? 'line-through text-gray-400 dark:text-gray-500'
                                  : 'text-gray-800 dark:text-gray-200'
                              }`}
                            >
                              {todo.title}
                            </h4>

                            {/* Tags row */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              {todo.due_date && (
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-800">
                                  <Calendar className="w-2.5 h-2.5" />
                                  {formatDate(todo.due_date)}
                                </span>
                              )}

                              {todo.is_recurring && (
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md border border-purple-100 dark:border-purple-900/60">
                                  <Repeat className="w-2.5 h-2.5" />
                                  {todo.recurrence_interval || 'recurring'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(todo)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                              title="Edit Todo"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(todo.id)}
                              disabled={isDeleting}
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                              title="Delete Todo"
                            >
                              {isDeleting ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-50 flex flex-col space-y-4 text-gray-900 dark:text-white">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold">
                  {editingTodo ? 'Edit To-Do' : 'Add To-Do'}
                </h4>
              </div>
            </div>

            {/* Title input */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Title *
              </label>
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="e.g. Follow up on machine warranty documentation"
                className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                }}
              />
            </div>

            {/* Priority Selector */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Priority
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'high' as TodoPriority, label: 'High', color: 'border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
                  { key: 'medium' as TodoPriority, label: 'Medium', color: 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
                  { key: 'low' as TodoPriority, label: 'Low', color: 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
                ].map(({ key, label, color }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setModalPriority(key)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all text-center ${
                      modalPriority === key
                        ? `${color} font-bold shadow-2xs`
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Due Date
              </label>
              <input
                type="date"
                value={modalDueDate}
                onChange={(e) => setModalDueDate(e.target.value)}
                className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Recurring Toggle */}
            <div className="flex flex-col space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5 cursor-pointer">
                  <Repeat className="w-3.5 h-3.5 text-purple-500" />
                  <span>Recursive To-Do</span>
                </label>
                <input
                  type="checkbox"
                  checked={modalIsRecurring}
                  onChange={(e) => setModalIsRecurring(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
              </div>

              {modalIsRecurring && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {['daily', 'weekly', 'monthly'].map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => setModalRecurrence(interval)}
                      className={`py-1.5 px-2.5 rounded-lg border text-xs capitalize transition-all ${
                        modalRecurrence === interval
                          ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 font-bold'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {interval}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !modalTitle.trim()}
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-900 to-pink-600 hover:opacity-90 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {editingTodo ? 'Save Changes' : 'Add To-Do'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
