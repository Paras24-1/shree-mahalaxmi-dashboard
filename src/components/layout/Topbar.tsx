'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Filter,
  CalendarDays,
  Clock,
  CheckSquare,
  ListTodo,
  StickyNote,
  FileText,
  Search,
  Moon,
  Sun,
  Bell,
  X,
  Plus,
  Users,
  LogOut,
  ChevronDown,
  Check,
  Calendar,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Mic,
  Menu,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface TopbarProps {
  onOpenSidebar?: () => void
}

export default function Topbar({ onOpenSidebar }: TopbarProps = {}) {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, signOut } = useAuth()

  const [dark, setDark] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{
    leads: any[]
    customers: any[]
    reminders: any[]
    tasks: any[]
  }>({ leads: [], customers: [], reminders: [], tasks: [] })
  const [isSearching, setIsSearching] = useState(false)

  // Notifications State
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])

  // Profile Menu State
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Quick Modals State
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDate, setTaskDate] = useState('')
  const [taskPriority, setTaskPriority] = useState('medium')
  const [savingTask, setSavingTask] = useState(false)

  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteColor, setNoteColor] = useState('yellow')
  const [savingNote, setSavingNote] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  // 1. Dark mode sync
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setDark(isDark)
  }, [])

  const toggleTheme = () => {
    const nextDark = !dark
    setDark(nextDark)
    if (nextDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // 2. Fetch live notifications
  const loadNotifications = async () => {
    try {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .order('scheduled_at', { ascending: true })
        .limit(10)

      if (data && data.length > 0) {
        setNotifications(data)
      } else {
        // Fallback default helpful notifications
        setNotifications([
          { id: '1', title: 'Welcome to Shree Mahalaxmi CRM', scheduled_at: new Date().toISOString(), type: 'system' },
          { id: '2', title: 'Daily Lead Follow-ups Scheduled', scheduled_at: new Date().toISOString(), type: 'followup' }
        ])
      }
    } catch {
      setNotifications([
        { id: '1', title: 'CRM Live Sync Active', scheduled_at: new Date().toISOString(), type: 'system' }
      ])
    }
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  // 3. Global search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ leads: [], customers: [], reminders: [], tasks: [] })
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const q = searchQuery.toLowerCase().trim()

      try {
        const [leadsRes, custRes, remRes, taskRes] = await Promise.all([
          supabase.from('leads').select('id, name, phone_number, stage').or(`name.ilike.%${q}%,phone_number.ilike.%${q}%`).limit(5),
          supabase.from('customers').select('id, name, phone_number, company').or(`name.ilike.%${q}%,phone_number.ilike.%${q}%,company.ilike.%${q}%`).limit(5),
          supabase.from('schedules').select('id, title, scheduled_at').ilike('title', `%${q}%`).limit(5),
          supabase.from('tasks').select('id, title, due_date, status').ilike('title', `%${q}%`).limit(5),
        ])

        setSearchResults({
          leads: leadsRes.data || [],
          customers: custRes.data || [],
          reminders: remRes.data || [],
          tasks: taskRes.data || [],
        })
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearchModal((v) => !v)
      }
      if (e.key === 'Escape') {
        setShowSearchModal(false)
        setShowQuickTaskModal(false)
        setShowQuickNoteModal(false)
        setShowNotifications(false)
        setShowProfileMenu(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Quick Task Creator
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim()) return
    setSavingTask(true)

    try {
      await supabase.from('tasks').insert({
        title: taskTitle.trim(),
        due_date: taskDate || new Date().toISOString().split('T')[0],
        priority: taskPriority,
        status: 'pending',
      })
      setShowQuickTaskModal(false)
      setTaskTitle('')
      setTaskDate('')
      router.push('/task')
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setSavingTask(false)
    }
  }

  // Quick Note Creator
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteTitle.trim() && !noteContent.trim()) return
    setSavingNote(true)

    try {
      await supabase.from('notes').insert({
        title: noteTitle.trim() || 'Untitled Note',
        content: noteContent.trim(),
        color: noteColor,
      })
      setShowQuickNoteModal(false)
      setNoteTitle('')
      setNoteContent('')
      router.push('/notes')
    } catch (err) {
      console.error('Failed to create note:', err)
    } finally {
      setSavingNote(false)
    }
  }

  const navLinks = [
    { name: 'Voice AI', href: '/analytics', icon: Mic, color: 'text-violet-500' },
    { name: 'Lead', href: '/lead', icon: Filter, color: 'text-orange-500' },
    { name: 'Task', href: '/task', icon: CalendarDays, color: 'text-gray-400' },
    { name: 'Reminder', href: '/reminder', icon: Clock, color: 'text-red-500' },
    { name: 'Meeting', href: '/meeting', icon: CalendarDays, color: 'text-orange-600' },
    { name: 'To Do', href: '/todo', icon: ListTodo, color: 'text-blue-500' },
    { name: 'Note', href: '/notes', icon: StickyNote, color: 'text-red-500' },
    { name: 'Invoice', href: '/invoice', icon: FileText, color: 'text-orange-400' },
  ]

  return (
    <>
      <header className="h-14 sm:h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-3 sm:px-6 shrink-0 z-20 gap-2">
        {/* Left Navigation & Mobile Menu */}
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto py-1 scrollbar-none min-w-0">
          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={onOpenSidebar}
            className="md:hidden p-2 -ml-1 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors shrink-0"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile Brand Name */}
          <div className="flex items-center gap-1.5 md:hidden shrink-0">
            <span className="font-extrabold text-blue-900 dark:text-blue-400 text-base tracking-tight">VoxAI</span>
          </div>

          {/* Quick Nav Links (Visible on Tablet/Desktop or Scrollable) */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3 text-xs font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">
            {navLinks.map((link, idx) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
              return (
                <div key={link.name} className="flex items-center gap-2 sm:gap-3">
                  <Link
                    href={link.href}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all ${
                      isActive
                        ? 'text-indigo-900 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 shadow-2xs'
                        : 'hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <link.icon className={`w-3.5 h-3.5 ${link.color}`} />
                    <span>{link.name}</span>
                  </Link>
                  {idx < navLinks.length - 1 && <span className="text-gray-200 dark:text-gray-800">|</span>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Icon Actions */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Quick Task Button */}
          <button
            onClick={() => setShowQuickTaskModal(true)}
            className="hidden sm:flex p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors"
            title="Create Quick Task"
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          {/* Quick Note Button */}
          <button
            onClick={() => setShowQuickNoteModal(true)}
            className="hidden sm:flex p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors"
            title="Create Quick Note"
          >
            <StickyNote className="w-4 h-4" />
          </button>

          {/* Global Search Button */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="p-2 text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/40 rounded-xl transition-colors"
            title="Search CRM (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {dark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowNotifications((v) => !v)
              }}
              className="relative p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-gray-950 animate-pulse">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4 z-50 text-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                  <span className="font-bold text-gray-900 dark:text-white">Live Notifications</span>
                  <span className="text-[10px] text-gray-400 font-mono">{notifications.length} active</span>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 divide-y divide-gray-50 dark:divide-gray-800/60">
                  {notifications.map((n) => (
                    <div key={n.id} className="pt-2 flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{n.title}</p>
                        <p className="text-[10px] text-gray-400 font-mono">
                          {new Date(n.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between">
                  <Link
                    href="/reminder"
                    onClick={() => setShowNotifications(false)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                  >
                    View All Reminders →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative" ref={profileRef}>
            <div
              onClick={(e) => {
                e.stopPropagation()
                setShowProfileMenu((v) => !v)
              }}
              className="flex items-center gap-3 border-l border-gray-200 dark:border-gray-800 pl-3 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[130px]">
                  Shree Mahalaxmi
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Store
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-900 to-indigo-700 text-white font-bold flex items-center justify-center text-xs shadow-md">
                SM
              </div>
            </div>

            {/* Profile Menu */}
            {showProfileMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1"
              >
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
                  <p className="font-bold text-gray-900 dark:text-white">Shree Mahalaxmi Enterprises</p>
                  <p className="text-[10px] text-gray-400">{profile?.email || 'admin@mahalaxmi.com'}</p>
                </div>

                <Link
                  href="/hr"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl font-medium"
                >
                  <Users className="w-3.5 h-3.5 text-orange-500" />
                  <span>HR & Team Operations</span>
                </Link>

                <Link
                  href="/customer"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
                >
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span>Customers CRM</span>
                </Link>

                <Link
                  href="/invoice"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl"
                >
                  <FileText className="w-3.5 h-3.5 text-gray-400" />
                  <span>Invoices & Billing</span>
                </Link>

                <button
                  onClick={async () => {
                    await signOut()
                    router.push('/login')
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl font-bold transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Global Search Modal ────────────────────────────────────── */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-20 p-4">
          <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4 z-50 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search across Leads, Customers, Tasks, Reminders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-8 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                onClick={() => setShowSearchModal(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-3 text-xs">
              {isSearching && (
                <div className="py-6 text-center text-gray-400">
                  <p>Searching...</p>
                </div>
              )}

              {!isSearching && searchQuery && searchResults.leads.length === 0 && searchResults.customers.length === 0 && searchResults.reminders.length === 0 && searchResults.tasks.length === 0 && (
                <div className="py-6 text-center text-gray-400">
                  <p>No results found for &quot;{searchQuery}&quot;</p>
                </div>
              )}

              {/* Leads Results */}
              {searchResults.leads.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Leads</p>
                  {searchResults.leads.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => {
                        setShowSearchModal(false)
                        router.push('/lead')
                      }}
                      className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5 text-orange-500" />
                        <span className="font-bold text-gray-900 dark:text-white">{l.name}</span>
                        {l.phone_number && <span className="text-gray-400 font-mono text-[11px]">{l.phone_number}</span>}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 font-bold">
                        {l.stage || 'new'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Customers Results */}
              {searchResults.customers.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Customers</p>
                  {searchResults.customers.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setShowSearchModal(false)
                        router.push('/customer')
                      }}
                      className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-bold text-gray-900 dark:text-white">{c.name}</span>
                        {c.company && <span className="text-gray-400 text-[11px]">({c.company})</span>}
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">{c.phone_number}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks Results */}
              {searchResults.tasks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2">Tasks</p>
                  {searchResults.tasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setShowSearchModal(false)
                        router.push('/task')
                      }}
                      className="p-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                        <span className="font-bold text-gray-900 dark:text-white">{t.title}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono">{t.due_date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-[10px] text-gray-400">
              <span>Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">ESC</kbd> to close</span>
              <span>Global CRM Search</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Task Modal ───────────────────────────────────────── */}
      {showQuickTaskModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <CheckSquare className="w-4 h-4" />
                <span>Quick Add Task</span>
              </div>
              <button onClick={() => setShowQuickTaskModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call client for machine demo"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-blue-500 outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 outline-none font-semibold"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowQuickTaskModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {savingTask ? 'Saving...' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick Note Modal ───────────────────────────────────────── */}
      {showQuickNoteModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
                <StickyNote className="w-4 h-4" />
                <span>Quick Sticky Note</span>
              </div>
              <button onClick={() => setShowQuickNoteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Note Title</label>
                <input
                  type="text"
                  placeholder="e.g. Quotation notes for Shree"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-amber-500 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Content</label>
                <textarea
                  rows={3}
                  placeholder="Type your notes here..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowQuickNoteModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNote}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
