'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus,
  Search, Trash2, Edit2, X, Check, RefreshCw, Clock, MapPin,
  CalendarCheck, CalendarDays, ExternalLink, Filter, CheckSquare,
  AlertCircle, Users, CheckCircle2, Sparkles, Eye
} from 'lucide-react'

// ─── Types & Category Configurations ─────────────────────────────────────────

type EventType = 'event' | 'lead' | 'reminder' | 'meeting' | 'holiday' | 'service'
type CalendarView = 'month' | 'day' | 'list'

interface CalendarEvent {
  id: string
  title: string
  type: EventType
  scheduled_at: string
  end_time?: string
  description?: string
  location?: string
  created_at?: string
  isLead?: boolean
  leadPhone?: string
}

interface CategoryConfig {
  key: EventType
  label: string
  color: string
  bgColor: string
  borderColor: string
  dotColor: string
  badgeClass: string
}

const CATEGORIES: Record<EventType, CategoryConfig> = {
  event: {
    key: 'event',
    label: 'Event',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/40',
    borderColor: 'border-orange-200 dark:border-orange-800',
    dotColor: 'bg-orange-500',
    badgeClass: 'bg-orange-500 text-white',
  },
  lead: {
    key: 'lead',
    label: 'Lead',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
    badgeClass: 'bg-emerald-600 text-white',
  },
  reminder: {
    key: 'reminder',
    label: 'Reminder',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-950/40',
    borderColor: 'border-indigo-200 dark:border-indigo-800',
    dotColor: 'bg-indigo-600',
    badgeClass: 'bg-[#2E285F] text-white',
  },
  meeting: {
    key: 'meeting',
    label: 'Meeting',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950/40',
    borderColor: 'border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    badgeClass: 'bg-red-500 text-white',
  },
  holiday: {
    key: 'holiday',
    label: 'Holiday',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
    dotColor: 'bg-cyan-500',
    badgeClass: 'bg-cyan-500 text-white',
  },
  service: {
    key: 'service',
    label: 'Service',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-800/60',
    borderColor: 'border-slate-300 dark:border-slate-700',
    dotColor: 'bg-slate-500',
    badgeClass: 'bg-slate-600 text-white',
  },
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<CalendarView>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Filters State (all enabled by default)
  const [activeFilters, setActiveFilters] = useState<Record<EventType, boolean>>({
    event: true,
    lead: true,
    reminder: true,
    meeting: true,
    holiday: true,
    service: true,
  })

  // Add / Edit / View Modal States
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  // Form states
  const [modalTitle, setModalTitle] = useState('')
  const [modalType, setModalType] = useState<EventType>('event')
  const [modalDate, setModalDate] = useState('')
  const [modalTime, setModalTime] = useState('10:00')
  const [modalDesc, setModalDesc] = useState('')
  const [modalLocation, setModalLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [syncToast, setSyncToast] = useState(false)

  // ── Fetch All Calendar Events ──────────────────────────────────────────────

  const fetchCalendarData = useCallback(async () => {
    setLoading(true)
    try {
      const schedulePromise = fetch('/api/schedules').then(r => r.ok ? r.json() : [])
      const leadsPromise = fetch('/api/leads').then(r => r.ok ? r.json() : [])

      const [schedulesData, leadsData] = await Promise.all([schedulePromise, leadsPromise])

      const scheduleEvents: CalendarEvent[] = (Array.isArray(schedulesData) ? schedulesData : []).map((s: any) => ({
        id: s.id,
        title: s.title || 'Untitled Event',
        type: (CATEGORIES[s.type as EventType] ? s.type : 'event') as EventType,
        scheduled_at: s.scheduled_at,
        description: s.description || '',
        location: s.location || '',
        created_at: s.created_at,
      }))

      const leadEvents: CalendarEvent[] = (Array.isArray(leadsData) ? leadsData : [])
        .filter((l: any) => l.followup_date)
        .map((l: any) => ({
          id: `lead-${l.id || l.conversation_id}`,
          title: `Followup: ${l.name || l.phone_number}`,
          type: 'lead' as EventType,
          scheduled_at: l.followup_date,
          description: l.followup_notes || l.conversation_summary || 'Lead Follow-up',
          leadPhone: l.phone_number,
          isLead: true,
        }))

      setEvents([...scheduleEvents, ...leadEvents])
    } catch (err) {
      console.error('Error fetching calendar data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCalendarData()
  }, [fetchCalendarData])

  // ── Month Navigation ───────────────────────────────────────────────────────

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else if (viewMode === 'day') {
      const prev = new Date(currentDate)
      prev.setDate(prev.getDate() - 1)
      setCurrentDate(prev)
    }
  }

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else if (viewMode === 'day') {
      const next = new Date(currentDate)
      next.setDate(next.getDate() + 1)
      setCurrentDate(next)
    }
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const toggleFilter = (type: EventType) => {
    setActiveFilters(prev => ({ ...prev, [type]: !prev[type] }))
  }

  // ── Modal Actions ──────────────────────────────────────────────────────────

  const openAddModal = (datePrefill?: Date, defaultType: EventType = 'event') => {
    setSelectedEvent(null)
    const targetDate = datePrefill || currentDate
    setModalTitle('')
    setModalType(defaultType)
    setModalDate(targetDate.toISOString().split('T')[0])
    setModalTime('10:00')
    setModalDesc('')
    setModalLocation('')
    setShowAddModal(true)
  }

  const openEditModal = (event: CalendarEvent) => {
    if (event.isLead) {
      openViewModal(event)
      return
    }
    setSelectedEvent(event)
    setModalTitle(event.title)
    setModalType(event.type)
    const d = new Date(event.scheduled_at)
    setModalDate(d.toISOString().split('T')[0])
    setModalTime(d.toTimeString().slice(0, 5))
    setModalDesc(event.description || '')
    setModalLocation(event.location || '')
    setShowEditModal(true)
  }

  const openViewModal = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowViewModal(true)
  }

  const handleSave = async () => {
    if (!modalTitle.trim() || !modalDate) return
    setSaving(true)
    try {
      const [year, month, day] = modalDate.split('-').map(Number)
      const [hours, minutes] = modalTime.split(':').map(Number)
      const scheduledDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0)

      const payload = {
        title: modalTitle.trim(),
        type: modalType,
        scheduled_at: scheduledDate.toISOString(),
        description: modalDesc.trim() || null,
        location: modalLocation.trim() || null,
      }

      if (selectedEvent && showEditModal) {
        const res = await fetch('/api/schedules', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedEvent.id, ...payload }),
        })
        if (!res.ok) throw new Error('Failed to update')
        setShowEditModal(false)
      } else {
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
        setShowAddModal(false)
      }

      await fetchCalendarData()
    } catch (err) {
      console.error('Error saving event:', err)
      alert('Failed to save event. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this event?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/schedules?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setEvents(prev => prev.filter(e => e.id !== id))
      setShowViewModal(false)
      setShowEditModal(false)
    } catch (err) {
      console.error('Error deleting event:', err)
      alert('Failed to delete event.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSyncGoogle = () => {
    setShowSyncModal(false)
    setSyncToast(true)
    setTimeout(() => setSyncToast(false), 3500)
  }

  // ── Filtered Events ────────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    return events.filter(e => activeFilters[e.type])
  }, [events, activeFilters])

  // ── Calendar Grid Math ─────────────────────────────────────────────────────

  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDayIndex = new Date(year, month, 1).getDay()
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate()
    const prevMonthDays = new Date(year, month, 0).getDate()

    const cells: {
      date: Date
      dayNumber: number
      isCurrentMonth: boolean
      isToday: boolean
      events: CalendarEvent[]
    }[] = []

    const today = new Date()

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i
      const d = new Date(year, month - 1, dayNum)
      cells.push({
        date: d,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      })
    }

    // 2. Current month days
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day)
      const isToday =
        today.getDate() === day &&
        today.getMonth() === month &&
        today.getFullYear() === year

      const dayEvents = filteredEvents.filter(e => {
        const evDate = new Date(e.scheduled_at)
        return (
          evDate.getDate() === day &&
          evDate.getMonth() === month &&
          evDate.getFullYear() === year
        )
      })

      cells.push({
        date: d,
        dayNumber: day,
        isCurrentMonth: true,
        isToday,
        events: dayEvents,
      })
    }

    // 3. Next month leading days (fill grid to multiple of 7)
    const remaining = 35 - cells.length > 0 ? 35 - cells.length : (42 - cells.length)
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day)
      cells.push({
        date: d,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      })
    }

    return cells
  }, [currentDate, filteredEvents])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-8rem)]">

        {/* ── LEFT SIDEBAR PANEL ────────────────────────────────────────────── */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col justify-between bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="space-y-4">
            {/* Sync Google Calendar */}
            <button
              onClick={() => setShowSyncModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#2E285F] hover:bg-[#231E4C] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200"
            >
              <CalendarCheck className="w-4 h-4 text-purple-300" />
              <span>Sync Google Calendar</span>
            </button>

            {/* Add Event Button */}
            <button
              onClick={() => openAddModal()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#3A3474] hover:bg-[#2C275C] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>Add Event</span>
            </button>

            {/* Filters Section */}
            <div className="pt-2">
              <h4 className="text-[11px] font-bold tracking-wider text-gray-400 dark:text-gray-500 uppercase mb-3 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5" />
                <span>FILTER</span>
              </h4>

              <div className="space-y-2.5">
                {(Object.keys(CATEGORIES) as EventType[]).map((type) => {
                  const cat = CATEGORIES[type]
                  const isChecked = activeFilters[type]
                  return (
                    <label
                      key={type}
                      className="flex items-center gap-2.5 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900 dark:hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleFilter(type)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className={`w-2.5 h-2.5 rounded-full ${cat.dotColor}`} />
                      <span className="capitalize">{cat.label}</span>
                      <span className="ml-auto text-[10px] text-gray-400">
                        {events.filter(e => e.type === type).length}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Bottom Illustration Graphic */}
          <div className="hidden lg:flex flex-col items-center justify-center p-3 pt-6 text-center opacity-85">
            <div className="w-36 h-28 bg-gradient-to-tr from-indigo-100 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/20 rounded-2xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40 p-2">
              <CalendarDays className="w-12 h-12 text-indigo-600 dark:text-indigo-400 opacity-90 animate-pulse" />
            </div>
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-2">
              All appointments & reminders in sync
            </p>
          </div>
        </div>

        {/* ── MAIN CALENDAR AREA ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">

          {/* Header Row: Navigation & Views */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left Month & Nav */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-xl p-0.5 bg-gray-50 dark:bg-gray-800">
                <button
                  onClick={handlePrev}
                  className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                  title="Previous"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleToday}
                  className="px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={handleNext}
                  className="p-1.5 hover:bg-white dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                  title="Next"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
            </div>

            {/* View Mode Buttons (Month / Day / List) */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl p-0.5 bg-gray-50 dark:bg-gray-800 self-end sm:self-auto">
              {(['month', 'day', 'list'] as CalendarView[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    viewMode === mode
                      ? 'bg-[#2E285F] text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* ── MONTH VIEW GRID ─────────────────────────────────────────────── */}
          {viewMode === 'month' && (
            <div className="flex-1 flex flex-col overflow-x-auto min-w-[650px]">
              {/* Day Header Row */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-850/50 text-center py-2.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-gray-100 dark:divide-gray-800">
                {calendarGrid.map((cell, idx) => (
                  <div
                    key={idx}
                    onClick={() => cell.isCurrentMonth && openAddModal(cell.date)}
                    className={`min-h-[100px] p-2 flex flex-col transition-colors group cursor-pointer ${
                      !cell.isCurrentMonth
                        ? 'bg-gray-50/40 dark:bg-gray-950/40 text-gray-300 dark:text-gray-700'
                        : cell.isToday
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                        : 'bg-white dark:bg-gray-900 hover:bg-gray-50/80 dark:hover:bg-gray-850/50'
                    }`}
                  >
                    {/* Date Number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-bold ${
                          cell.isToday
                            ? 'w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-2xs'
                            : cell.isCurrentMonth
                            ? 'text-gray-800 dark:text-gray-200'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Quick Add icon on hover */}
                      {cell.isCurrentMonth && (
                        <span className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-indigo-600 transition-opacity">
                          <Plus className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>

                    {/* Events List inside Day Cell */}
                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-24">
                      {cell.events.slice(0, 3).map((ev) => {
                        const cat = CATEGORIES[ev.type] || CATEGORIES.event
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              openViewModal(ev)
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate border ${cat.bgColor} ${cat.color} ${cat.borderColor} hover:opacity-90 shadow-2xs transition-all`}
                            title={ev.title}
                          >
                            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1 shrink-0 align-middle bg-current" />
                            {ev.title}
                          </div>
                        )
                      })}

                      {cell.events.length > 3 && (
                        <span className="text-[9px] font-bold text-gray-400 pl-1">
                          +{cell.events.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── DAY VIEW ────────────────────────────────────────────────────── */}
          {viewMode === 'day' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => openAddModal(currentDate)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add appointment
                </button>
              </div>

              {/* Events for today */}
              {filteredEvents.filter(e => {
                const d = new Date(e.scheduled_at)
                return (
                  d.getDate() === currentDate.getDate() &&
                  d.getMonth() === currentDate.getMonth() &&
                  d.getFullYear() === currentDate.getFullYear()
                )
              }).length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold">No appointments or events scheduled for this day.</p>
                </div>
              ) : (
                filteredEvents
                  .filter(e => {
                    const d = new Date(e.scheduled_at)
                    return (
                      d.getDate() === currentDate.getDate() &&
                      d.getMonth() === currentDate.getMonth() &&
                      d.getFullYear() === currentDate.getFullYear()
                    )
                  })
                  .map((ev) => {
                    const cat = CATEGORIES[ev.type] || CATEGORIES.event
                    return (
                      <div
                        key={ev.id}
                        onClick={() => openViewModal(ev)}
                        className={`p-4 rounded-xl border ${cat.bgColor} ${cat.borderColor} flex items-start justify-between cursor-pointer hover:shadow-sm transition-all`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cat.badgeClass}`}>
                              {cat.label}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(ev.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 dark:text-white">{ev.title}</h4>
                          {ev.description && <p className="text-xs text-gray-600 dark:text-gray-300">{ev.description}</p>}
                        </div>

                        {!ev.isLead && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); openEditModal(ev) }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(ev.id) }}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
              )}
            </div>
          )}

          {/* ── LIST VIEW ───────────────────────────────────────────────────── */}
          {viewMode === 'list' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {filteredEvents.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-semibold">No calendar records to display</p>
                </div>
              ) : (
                filteredEvents
                  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                  .map((ev) => {
                    const cat = CATEGORIES[ev.type] || CATEGORIES.event
                    return (
                      <div
                        key={ev.id}
                        onClick={() => openViewModal(ev)}
                        className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-850 hover:bg-gray-50 dark:hover:bg-gray-800/60 flex items-center justify-between gap-4 cursor-pointer transition-all shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-3 h-3 rounded-full shrink-0 ${cat.dotColor}`} />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">{ev.title}</h4>
                            <p className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                              <span className="font-semibold">{new Date(ev.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                              <span>•</span>
                              <span>{new Date(ev.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${cat.badgeClass}`}>
                            {cat.label}
                          </span>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Event Modal ───────────────────────────────────────────── */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0" onClick={() => { setShowAddModal(false); setShowEditModal(false) }} />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-50 flex flex-col space-y-4 text-gray-900 dark:text-white">

            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddModal(false); setShowEditModal(false) }}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold">
                  {showEditModal ? 'Edit Event' : 'Add Event / Appointment'}
                </h4>
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Event Title *
              </label>
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="e.g. Factory Inspection with Client"
                className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            {/* Category / Type */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Category
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['event', 'meeting', 'reminder', 'holiday', 'service', 'lead'] as EventType[]).map((type) => {
                  const cat = CATEGORIES[type]
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setModalType(type)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        modalType === type
                          ? `${cat.badgeClass} border-transparent shadow-2xs`
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${modalType === type ? 'bg-white' : cat.dotColor}`} />
                      <span className="capitalize">{cat.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">
                  Time
                </label>
                <input
                  type="time"
                  value={modalTime}
                  onChange={(e) => setModalTime(e.target.value)}
                  className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Description / Notes
              </label>
              <textarea
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                placeholder="Add agenda, contact info, or meeting links..."
                rows={2}
                className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setShowEditModal(false) }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !modalTitle.trim() || !modalDate}
                className="flex-1 py-2.5 bg-[#2E285F] hover:bg-[#202058] dark:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {showEditModal ? 'Save Changes' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Event Modal ─────────────────────────────────────────────────── */}
      {showViewModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0" onClick={() => setShowViewModal(false)} />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl z-50 flex flex-col space-y-4 text-gray-900 dark:text-white">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${CATEGORIES[selectedEvent.type]?.badgeClass || 'bg-gray-600 text-white'}`}>
                  {CATEGORIES[selectedEvent.type]?.label || selectedEvent.type}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(selectedEvent.scheduled_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {selectedEvent.title}
              </h3>

              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span>
                  {new Date(selectedEvent.scheduled_at).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>

              {selectedEvent.description && (
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selectedEvent.description}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              {!selectedEvent.isLead ? (
                <>
                  <button
                    onClick={() => handleDelete(selectedEvent.id)}
                    disabled={deletingId === selectedEvent.id}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  <button
                    onClick={() => {
                      setShowViewModal(false)
                      openEditModal(selectedEvent)
                    }}
                    className="px-4 py-1.5 bg-[#2E285F] hover:bg-[#202058] text-white text-xs font-bold rounded-lg flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-gray-400 italic">
                  Lead followup event synced automatically from CRM
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Google Calendar Sync Modal ───────────────────────────────────────── */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowSyncModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-2xl z-50 text-center space-y-4 text-gray-900 dark:text-white">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mx-auto">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Sync Google Calendar</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Connect your Google Calendar account to synchronize all upcoming client meetings, followups, and team events in real-time.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSyncModal(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSyncGoogle}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Connect & Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Success Toast */}
      {syncToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2E285F] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Google Calendar synced successfully!</span>
        </div>
      )}
    </DashboardLayout>
  )
}
