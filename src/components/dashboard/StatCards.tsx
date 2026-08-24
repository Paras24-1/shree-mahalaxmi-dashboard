'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, Send, Calendar, ListTodo, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function matchesDateFilter(createdAt: string | undefined, filter: 'today' | 'yesterday'): boolean {
  if (!createdAt) return false
  const leadTime = new Date(createdAt).getTime()
  if (isNaN(leadTime)) return false

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000

  if (filter === 'today') {
    return leadTime >= startOfToday
  }
  if (filter === 'yesterday') {
    return leadTime >= startOfYesterday && leadTime < startOfToday
  }
  return true
}

export default function StatCards() {
  const router = useRouter()
  const [stats, setStats] = useState({
    leads: { total: 0, completed: 0, increase: 0 },
    followups: { total: 0, completed: 0 },
    tasks: { total: 0, completed: 0 },
    todos: { total: 0, completed: 0 },
  })

  useEffect(() => {
    async function loadStats() {
      const now = new Date()
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      try {
        const [leadsRes, convsRes, tasksRes, todosRes] = await Promise.all([
          supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(2000),
          supabase.from('conversations').select('id, name, phone_number, stage, created_at, updated_at').order('updated_at', { ascending: false }).limit(2000),
          supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(1000),
          supabase.from('todos').select('*').order('created_at', { ascending: false }).limit(1000),
        ])

        const leadMap = new Map<string, any>()
        if (convsRes.data) {
          convsRes.data.forEach((c) => {
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
        if (leadsRes.data) {
          leadsRes.data.forEach((l) => {
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

        const allUnifiedLeads = Array.from(leadMap.values())
        const todayLeads = allUnifiedLeads.filter((l) => matchesDateFilter(l.created_at, 'today'))
        const yesterdayLeads = allUnifiedLeads.filter((l) => matchesDateFilter(l.created_at, 'yesterday'))
        
        const completedTodayLeads = todayLeads.filter((l) =>
          ['confirm', 'confirmed', 'completed', 'deal_done', 'booked', 'won', 'closed'].includes(
            (l.stage || '').toLowerCase()
          )
        )

        // Followups: from followup_date today OR in processing stage
        const processingFollowups = allUnifiedLeads.filter((l) =>
          ['processing', 'in_process', 'followup'].includes((l.stage || '').toLowerCase())
        )
        const dateFollowups = allUnifiedLeads.filter((l) => l.followup_date && l.followup_date.startsWith(todayDateStr))
        const totalFollowups = dateFollowups.length > 0 ? dateFollowups.length : processingFollowups.length
        const completedFollowups = allUnifiedLeads.filter((l) => l.followup_notified).length

        const allTasks = tasksRes.data || []
        const todayTasks = allTasks.filter(
          (t) => t.due_date === todayDateStr || (!t.due_date && matchesDateFilter(t.created_at, 'today'))
        )
        const totalTasks = todayTasks.length > 0 ? todayTasks.length : allTasks.length
        const completedTasks = (todayTasks.length > 0 ? todayTasks : allTasks).filter((t) => t.status === 'completed').length

        const allTodos = todosRes.data || []
        const todayTodos = allTodos.filter((t) => matchesDateFilter(t.created_at, 'today'))
        const totalTodos = todayTodos.length > 0 ? todayTodos.length : allTodos.length
        const completedTodos = (todayTodos.length > 0 ? todayTodos : allTodos).filter((t) => t.status === 'completed').length

        const yCount = yesterdayLeads.length
        const tCount = todayLeads.length
        let leadIncrease = 0
        if (yCount === 0) {
          leadIncrease = tCount > 0 ? 100 : 0
        } else {
          leadIncrease = Number((((tCount - yCount) / yCount) * 100).toFixed(2))
        }

        setStats({
          leads: {
            total: tCount,
            completed: completedTodayLeads.length,
            increase: leadIncrease,
          },
          followups: {
            total: totalFollowups,
            completed: completedFollowups,
          },
          tasks: {
            total: totalTasks,
            completed: completedTasks,
          },
          todos: {
            total: totalTodos,
            completed: completedTodos,
          },
        })
      } catch (err) {
        console.error('Error fetching today stats:', err)
      }
    }

    loadStats()
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Leads Card */}
      <div
        onClick={() => router.push('/lead?filter=today')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/lead?filter=today') }}
        className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-green-300 dark:hover:border-green-700/60 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-50 dark:bg-green-950/40 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Filter className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>Today's Leads</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-green-500 transition-opacity -ml-0.5" />
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.leads.total}</h3>
              </div>
            </div>
            <Filter className="w-8 h-8 text-green-100 dark:text-green-950 opacity-50 group-hover:opacity-80 transition-opacity" />
          </div>
          <p className="text-xs text-green-500 font-medium mt-2">{stats.leads.increase}% Increase <span className="text-gray-400">vs Yesterday</span></p>
        </div>

        <div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Completed Lead</span>
            <span className="text-xs font-bold text-green-500">{stats.leads.total > 0 ? ((stats.leads.completed / stats.leads.total) * 100).toFixed(2) : 0}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 mt-2 rounded-full overflow-hidden">
            <div className="bg-green-500 h-full transition-all" style={{ width: `${stats.leads.total > 0 ? (stats.leads.completed / stats.leads.total) * 100 : 0}%` }}></div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-green-600 dark:text-green-400 font-semibold opacity-80 group-hover:opacity-100">
            <span>Tap to view leads</span>
            <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              View &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Followups Card */}
      <div
        onClick={() => router.push('/reminder?filter=today')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/reminder?filter=today') }}
        className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-red-300 dark:hover:border-red-700/60 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Send className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>Today's Followups</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-red-500 transition-opacity -ml-0.5" />
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.followups.total}</h3>
              </div>
            </div>
            <Send className="w-8 h-8 text-red-100 dark:text-red-950 opacity-50 group-hover:opacity-80 transition-opacity" />
          </div>
          <p className="text-xs text-red-500 font-medium mt-2">{stats.followups.completed} Completed <span className="text-gray-400">{stats.followups.total}</span></p>
        </div>

        <div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Completed Followup</span>
            <span className="text-xs font-bold text-red-500">{stats.followups.total > 0 ? ((stats.followups.completed / stats.followups.total) * 100).toFixed(2) : 100.00}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 mt-2 rounded-full overflow-hidden">
            <div className="bg-red-500 h-full transition-all" style={{ width: `${stats.followups.total > 0 ? (stats.followups.completed / stats.followups.total) * 100 : 100}%` }}></div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-red-600 dark:text-red-400 font-semibold opacity-80 group-hover:opacity-100">
            <span>Tap to view followups</span>
            <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              View &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Tasks Card */}
      <div
        onClick={() => router.push('/task')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/task') }}
        className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700/60 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Calendar className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>Today's Tasks</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-orange-500 transition-opacity -ml-0.5" />
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.tasks.total}</h3>
              </div>
            </div>
            <Calendar className="w-8 h-8 text-orange-100 dark:text-orange-950 opacity-50 group-hover:opacity-80 transition-opacity" />
          </div>
          <p className="text-xs text-orange-500 font-medium mt-2">{stats.tasks.completed} Completed <span className="text-gray-400">{stats.tasks.total}</span></p>
        </div>

        <div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Completed Task</span>
            <span className="text-xs font-bold text-orange-500">{stats.tasks.total > 0 ? ((stats.tasks.completed / stats.tasks.total) * 100).toFixed(2) : 100.00}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 mt-2 rounded-full overflow-hidden">
            <div className="bg-orange-500 h-full transition-all" style={{ width: `${stats.tasks.total > 0 ? (stats.tasks.completed / stats.tasks.total) * 100 : 100}%` }}></div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-orange-600 dark:text-orange-400 font-semibold opacity-80 group-hover:opacity-100">
            <span>Tap to view tasks</span>
            <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              View &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Todos Card */}
      <div
        onClick={() => router.push('/todo')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push('/todo') }}
        className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-700/60 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center group-hover:scale-105 transition-transform">
                <ListTodo className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span>Today's Todos</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-cyan-500 transition-opacity -ml-0.5" />
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todos.total}</h3>
              </div>
            </div>
            <ListTodo className="w-8 h-8 text-cyan-100 dark:text-cyan-950 opacity-50 group-hover:opacity-80 transition-opacity" />
          </div>
          <p className="text-xs text-cyan-500 font-medium mt-2">{stats.todos.completed} Completed <span className="text-gray-400">{stats.todos.total}</span></p>
        </div>

        <div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Completed Todo</span>
            <span className="text-xs font-bold text-cyan-500">{stats.todos.total > 0 ? ((stats.todos.completed / stats.todos.total) * 100).toFixed(2) : 100.00}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 mt-2 rounded-full overflow-hidden">
            <div className="bg-cyan-500 h-full transition-all" style={{ width: `${stats.todos.total > 0 ? (stats.todos.completed / stats.todos.total) * 100 : 100}%` }}></div>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold opacity-80 group-hover:opacity-100">
            <span>Tap to view todos</span>
            <span className="flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              View &rarr;
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
