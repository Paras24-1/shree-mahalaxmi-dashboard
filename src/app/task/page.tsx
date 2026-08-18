'use client'

import React, { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Plus, Search, Trash2, Edit2, X, Check, RefreshCw,
  CheckSquare, Calendar, AlertCircle, ChevronDown, Flag,
} from 'lucide-react'

type TaskStatus = 'new' | 'in_feedback' | 'completed' | 'rejected'
type TaskPriority = 'high' | 'medium' | 'low'

interface Task {
  id: string
  title: string
  description?: string
  due_date: string
  status: TaskStatus
  priority: TaskPriority
  created_at: string
}

// ─── Column Config ────────────────────────────────────────────────────────────

const COLUMNS: { key: TaskStatus; label: string; headerBg: string; headerText: string; dotColor: string }[] = [
  { key: 'new',         label: 'New',         headerBg: 'bg-teal-600',   headerText: 'text-white', dotColor: 'bg-teal-400' },
  { key: 'in_feedback', label: 'In Feedback', headerBg: 'bg-purple-700', headerText: 'text-white', dotColor: 'bg-purple-400' },
  { key: 'completed',   label: 'Completed',   headerBg: 'bg-green-700',  headerText: 'text-white', dotColor: 'bg-green-400' },
  { key: 'rejected',    label: 'Rejected',    headerBg: 'bg-red-600',    headerText: 'text-white', dotColor: 'bg-red-400' },
]

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high:   'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200',
  low:    'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200',
}

function formatDueDate(dateStr: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isDueOverdue(dateStr: string) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date(new Date().toDateString())
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TaskPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [modalTitle, setModalTitle] = useState('')
  const [modalDesc, setModalDesc] = useState('')
  const [modalDueDate, setModalDueDate] = useState('')
  const [modalStatus, setModalStatus] = useState<TaskStatus>('new')
  const [modalPriority, setModalPriority] = useState<TaskPriority>('medium')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Task[] = await res.json()
      setTasks(data)
    } catch (err) {
      console.error('Error fetching tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openAddModal = (defaultStatus: TaskStatus = 'new') => {
    setEditingTask(null)
    setModalTitle('')
    setModalDesc('')
    setModalDueDate(new Date().toISOString().split('T')[0])
    setModalStatus(defaultStatus)
    setModalPriority('medium')
    setShowModal(true)
  }

  const openEditModal = (task: Task) => {
    setEditingTask(task)
    setModalTitle(task.title)
    setModalDesc(task.description || '')
    setModalDueDate(task.due_date?.split('T')[0] || new Date().toISOString().split('T')[0])
    setModalStatus(task.status)
    setModalPriority(task.priority || 'medium')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!modalTitle.trim()) return
    setSaving(true)
    try {
      const payload = {
        title: modalTitle.trim(),
        description: modalDesc.trim() || null,
        due_date: modalDueDate,
        status: modalStatus,
        priority: modalPriority,
      }
      if (editingTask) {
        const res = await fetch('/api/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTask.id, ...payload }),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
      }
      setShowModal(false)
      await fetchTasks()
    } catch (err) {
      console.error('Error saving task:', err)
      alert('Failed to save task. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this task?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      console.error('Error deleting task:', err)
      alert('Failed to delete task.')
    } finally {
      setDeletingId(null)
    }
  }

  // Quick status change (move card between columns)
  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update status')
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: newStatus } : t))
    } catch (err) {
      console.error('Error changing status:', err)
    }
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const searchedTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const tasksByStatus = (status: TaskStatus) =>
    searchedTasks.filter((t) => t.status === status)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Tasks</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{tasks.length} total task{tasks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative hidden md:block w-60">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => openAddModal('new')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-900 to-pink-500 hover:from-blue-800 hover:to-pink-400 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
      </div>

      {/* Mobile search */}
      <div className="relative md:hidden mb-4">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mb-3" />
          <p className="text-sm text-gray-500">Loading tasks...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus(col.key)
            return (
              <div key={col.key} className="flex flex-col min-h-[400px]">
                {/* Column Header */}
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl mb-3 ${col.headerBg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                    <span className={`text-sm font-semibold ${col.headerText}`}>{col.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold ${col.headerText}`}>
                      {colTasks.length}
                    </span>
                    <button
                      onClick={() => openAddModal(col.key)}
                      className={`w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors ${col.headerText}`}
                      title={`Add task to ${col.label}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-400 dark:text-gray-600 flex-1">
                      <p className="text-xs">No tasks here</p>
                      <button
                        onClick={() => openAddModal(col.key)}
                        className="mt-2 text-xs text-blue-500 hover:underline font-medium"
                      >
                        + Add one
                      </button>
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const overdue = isDueOverdue(task.due_date)
                      const isDeleting = deletingId === task.id
                      return (
                        <div
                          key={task.id}
                          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all duration-200 group"
                        >
                          {/* Priority + Actions */}
                          <div className="flex items-center justify-between mb-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${PRIORITY_STYLES[task.priority || 'medium']}`}>
                              <Flag className="inline w-2.5 h-2.5 mr-0.5 -mt-px" />
                              {task.priority || 'medium'}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditModal(task)}
                                className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDelete(task.id)}
                                disabled={isDeleting}
                                className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                              >
                                {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug mb-1 line-clamp-2">{task.title}</h4>

                          {/* Description */}
                          {task.description && (
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 leading-relaxed">{task.description}</p>
                          )}

                          {/* Due date */}
                          <div className={`flex items-center gap-1 text-[10px] font-medium mb-3 ${overdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                            {overdue ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                            {formatDueDate(task.due_date)}
                            {overdue && <span className="ml-0.5">(overdue)</span>}
                          </div>

                          {/* Move to column */}
                          <div className="flex flex-wrap gap-1">
                            {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                              <button
                                key={c.key}
                                onClick={() => handleStatusChange(task, c.key)}
                                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold text-white ${c.headerBg} opacity-70 hover:opacity-100 transition-opacity`}
                              >
                                → {c.label}
                              </button>
                            ))}
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

            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold">{editingTask ? 'Edit Task' : 'Add Task'}</h4>
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Task Title *</label>
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="e.g. Prepare machine quotation for Sharma Ji"
                className="w-full text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Description</label>
              <textarea
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                placeholder="Optional notes about this task..."
                rows={2}
                className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-400 resize-none"
              />
            </div>

            {/* Due Date + Priority row */}
            <div className="flex gap-3">
              <div className="flex-1 flex flex-col space-y-1">
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Due Date</label>
                <input
                  type="date"
                  value={modalDueDate}
                  onChange={(e) => setModalDueDate(e.target.value)}
                  className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="flex-1 flex flex-col space-y-1">
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Priority</label>
                <div className="relative">
                  <select
                    value={modalPriority}
                    onChange={(e) => setModalPriority(e.target.value as TaskPriority)}
                    className="w-full appearance-none text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 pr-7"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="flex flex-col space-y-2">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Column / Status</label>
              <div className="grid grid-cols-2 gap-2">
                {COLUMNS.map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => setModalStatus(col.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      modalStatus === col.key
                        ? `${col.headerBg} text-white border-transparent`
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${modalStatus === col.key ? 'bg-white/60' : col.dotColor}`} />
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Buttons */}
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
                className="flex-1 py-2.5 bg-gradient-to-r from-blue-900 to-pink-500 hover:from-blue-800 hover:to-pink-400 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editingTask ? 'Save Changes' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
