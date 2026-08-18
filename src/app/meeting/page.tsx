'use client'

import React, { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  Clock,
  Calendar,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  CalendarDays,
  Users,
  CalendarOff,
} from 'lucide-react'

interface Meeting {
  id: string
  type: string
  title: string
  scheduled_at: string
  created_at: string
}

function getMeetingStatus(scheduledAt: string): {
  label: 'Overdue' | 'Today' | 'Upcoming'
  style: string
} {
  const d = new Date(scheduledAt)
  const now = new Date()
  if (d.getTime() < now.getTime()) {
    return { label: 'Overdue', style: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-900/60' }
  }
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (isToday) {
    return { label: 'Today', style: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60' }
  }
  return { label: 'Upcoming', style: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60' }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function getTimeAgo(dateStr: string) {
  const now = new Date()
  const d = new Date(dateStr)
  const diffMs = d.getTime() - now.getTime()
  const absDiff = Math.abs(diffMs)
  const mins = Math.floor(absDiff / 60000)
  const hours = Math.floor(absDiff / 3600000)
  const days = Math.floor(absDiff / 86400000)
  const past = diffMs < 0
  if (days > 0) return past ? `${days}d ago` : `in ${days}d`
  if (hours > 0) return past ? `${hours}h ago` : `in ${hours}h`
  if (mins > 0) return past ? `${mins}m ago` : `in ${mins}m`
  return 'Now'
}

function getPresets() {
  const now = new Date()
  const todayPlus1 = new Date(now)
  todayPlus1.setHours(now.getHours() + 1, 0, 0, 0)
  const todayPlus3 = new Date(now)
  todayPlus3.setHours(now.getHours() + 3, 0, 0, 0)
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)
  const nextWeek = new Date(now)
  nextWeek.setDate(now.getDate() + 7)
  nextWeek.setHours(10, 0, 0, 0)
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const dayName = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' })
  return [
    { label: 'In 1 hour', sublabel: fmt(todayPlus1), date: todayPlus1 },
    { label: 'In 3 hours', sublabel: fmt(todayPlus3), date: todayPlus3 },
    { label: 'Tomorrow', sublabel: dayName(tomorrow), date: tomorrow },
    { label: 'Next week', sublabel: dayName(nextWeek), date: nextWeek },
  ]
}

export default function MeetingPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [modalTitle, setModalTitle] = useState('')
  const [modalDate, setModalDate] = useState<Date | null>(null)
  const [customMode, setCustomMode] = useState(false)
  const [customDateVal, setCustomDateVal] = useState('')
  const [customTimeVal, setCustomTimeVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/schedules')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Meeting[] = await res.json()
      setMeetings(data.filter((r) => r.type === 'meeting'))
    } catch (err) {
      console.error('Error fetching meetings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])

  const openAddModal = () => {
    setEditingMeeting(null)
    setModalTitle('')
    const d = new Date()
    d.setHours(d.getHours() + 1, 0, 0, 0)
    setModalDate(d)
    setCustomMode(false)
    setCustomDateVal(d.toISOString().split('T')[0])
    setCustomTimeVal(d.toTimeString().slice(0, 5))
    setShowModal(true)
  }

  const openEditModal = (meeting: Meeting) => {
    setEditingMeeting(meeting)
    setModalTitle(meeting.title)
    const d = new Date(meeting.scheduled_at)
    setModalDate(d)
    setCustomMode(true)
    setCustomDateVal(d.toISOString().split('T')[0])
    setCustomTimeVal(d.toTimeString().slice(0, 5))
    setShowModal(true)
  }

  const updateCustomDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return
    const [year, month, day] = dateStr.split('-').map(Number)
    const [hour, min] = timeStr.split(':').map(Number)
    setModalDate(new Date(year, month - 1, day, hour, min, 0, 0))
  }

  const handleSave = async () => {
    if (!modalTitle.trim() || !modalDate) return
    setSaving(true)
    try {
      if (editingMeeting) {
        const res = await fetch('/api/schedules', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingMeeting.id, title: modalTitle.trim(), scheduled_at: modalDate.toISOString() }),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'meeting', title: modalTitle.trim(), scheduled_at: modalDate.toISOString() }),
        })
        if (!res.ok) throw new Error('Failed to create')
      }
      setShowModal(false)
      await fetchMeetings()
    } catch (err) {
      console.error('Error saving meeting:', err)
      alert('Failed to save meeting. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this meeting?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setMeetings((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      console.error('Error deleting meeting:', err)
      alert('Failed to delete meeting.')
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = meetings.filter((m) => {
    const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase())
    if (!matchesSearch) return false
    if (filterType === 'all') return true
    const { label } = getMeetingStatus(m.scheduled_at)
    return label.toLowerCase() === filterType
  })

  const countByStatus = (status: 'overdue' | 'today' | 'upcoming') =>
    meetings.filter((m) => getMeetingStatus(m.scheduled_at).label.toLowerCase() === status).length

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
            <CalendarDays className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Meetings</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} scheduled
            </p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Add Meeting
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {([
            { key: 'all' as const, label: `All (${meetings.length})`, Icon: null as React.ElementType | null, activeColor: 'bg-orange-600 border-orange-600 text-white', idleColor: 'text-gray-700 border-gray-200 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-700' },
            { key: 'overdue' as const, label: `Overdue (${countByStatus('overdue')})`, Icon: AlertCircle as React.ElementType, activeColor: 'bg-red-600 border-red-600 text-white', idleColor: 'text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-950' },
            { key: 'today' as const, label: `Today (${countByStatus('today')})`, Icon: Clock as React.ElementType, activeColor: 'bg-amber-500 border-amber-500 text-white', idleColor: 'text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-950' },
            { key: 'upcoming' as const, label: `Upcoming (${countByStatus('upcoming')})`, Icon: Calendar as React.ElementType, activeColor: 'bg-emerald-500 border-emerald-500 text-white', idleColor: 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-950' },
          ]).map(({ key, label, Icon, activeColor, idleColor }) => {
            const isActive = filterType === key
            return (
              <button
                key={key}
                onClick={() => setFilterType(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${isActive ? activeColor : `bg-white dark:bg-gray-800 ${idleColor}`}`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </button>
            )
          })}
        </div>
        <div className="relative md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <RefreshCw className="w-8 h-8 text-orange-400 animate-spin mb-3" />
          <p className="text-sm text-gray-500">Loading meetings...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center mb-4">
            <CalendarOff className="w-8 h-8 text-orange-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
            {searchQuery || filterType !== 'all' ? 'No meetings found' : 'No meetings yet'}
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mb-5">
            {searchQuery || filterType !== 'all'
              ? 'No meetings match your search or selected filter.'
              : 'No meetings scheduled yet. Click Add Meeting to get started.'}
          </p>
          {!searchQuery && filterType === 'all' && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-xl shadow-md hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Meeting
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((meeting) => {
            const status = getMeetingStatus(meeting.scheduled_at)
            const isDeleting = deletingId === meeting.id
            return (
              <div
                key={meeting.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-orange-300 dark:hover:border-orange-900 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-orange-600" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">{meeting.title}</h4>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full ${status.style}`}>{status.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800/40 mb-3">
                    <CalendarDays className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                    <span className="font-medium truncate">{formatDate(meeting.scheduled_at)}</span>
                    <span className="ml-auto shrink-0 text-[10px] font-semibold text-gray-400">{getTimeAgo(meeting.scheduled_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
                  <button
                    onClick={() => openEditModal(meeting)}
                    className="flex-1 py-2 flex items-center justify-center gap-1.5 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-[11px] font-semibold transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(meeting.id)}
                    disabled={isDeleting}
                    className="p-2 border border-red-100 hover:bg-red-50 dark:border-red-950/30 dark:hover:bg-red-950/40 text-red-500 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0" onClick={() => setShowModal(false)} />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-50 flex flex-col space-y-4 text-gray-900 dark:text-white">

            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold">{editingMeeting ? 'Edit Meeting' : 'Add Meeting'}</h4>
              </div>
              {modalDate && (
                <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-full">
                  {formatDate(modalDate.toISOString())}
                </span>
              )}
            </div>

            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Meeting Title *</label>
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="e.g. Product demo with Ramesh Traders"
                className="w-full text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-400"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-2">When</label>
              <div className="grid grid-cols-2 gap-2">
                {getPresets().map((preset, idx) => {
                  const isSelected = modalDate && !customMode && Math.abs(modalDate.getTime() - preset.date.getTime()) < 60 * 1000
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setModalDate(preset.date)
                        setCustomMode(false)
                        setCustomDateVal(preset.date.toISOString().split('T')[0])
                        setCustomTimeVal(preset.date.toTimeString().slice(0, 5))
                      }}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${isSelected ? 'bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-950/40 dark:border-orange-500 dark:text-orange-400 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'}`}
                    >
                      <span className="text-xs font-semibold">{preset.label}</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{preset.sublabel}</span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${customMode ? 'bg-orange-50 border-orange-400 text-orange-700 dark:bg-orange-950/40 dark:border-orange-500 dark:text-orange-400 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300'}`}
                >
                  <span className="text-xs font-semibold">Custom</span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Pick Date/Time</span>
                </button>
              </div>
            </div>

            {customMode && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    value={customDateVal}
                    onChange={(e) => { setCustomDateVal(e.target.value); updateCustomDateTime(e.target.value, customTimeVal) }}
                    className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase tracking-wider">Time</label>
                  <input
                    type="time"
                    value={customTimeVal}
                    onChange={(e) => { setCustomTimeVal(e.target.value); updateCustomDateTime(customDateVal, e.target.value) }}
                    className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
            )}

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
                disabled={saving || !modalTitle.trim() || !modalDate}
                className="flex-1 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editingMeeting ? 'Save Changes' : 'Add Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
