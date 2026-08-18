'use client'

import { useState, useEffect } from 'react'
import { Filter, Send, Calendar, ListTodo } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function StatCards() {
  const [stats, setStats] = useState({
    leads: { total: 0, completed: 0, increase: 0 },
    followups: { total: 0, completed: 0 },
    tasks: { total: 0, completed: 0 },
    todos: { total: 0, completed: 0 },
  })

  useEffect(() => {
    async function loadStats() {
      // Get today's start and end timestamps (local day boundaries)
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const todayISO = startOfToday.toISOString()
      const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      // Yesterday boundaries for comparison
      const startOfYesterday = new Date(startOfToday)
      startOfYesterday.setDate(startOfYesterday.getDate() - 1)
      const yesterdayISO = startOfYesterday.toISOString()

      try {
        // Run all queries simultaneously in parallel with Promise.all
        const [
          todayLeadsRes,
          completedTodayLeadsRes,
          yesterdayLeadsRes,
          todayFollowupRes,
          completedFollowupRes,
          todayTaskRes,
          completedTaskRes,
          todayTodoRes,
          completedTodoRes,
        ] = await Promise.all([
          // 1. Today's Leads count
          supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
          // 2. Completed today leads
          supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).in('stage', ['completed', 'booked', 'deal_done', 'won']),
          // 3. Yesterday leads count
          supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayISO).lt('created_at', todayISO),
          // 4. Today's followups
          supabase.from('leads').select('*', { count: 'exact', head: true }).or(`followup_date.eq.${todayDateStr},followup_date.gte.${todayISO}`),
          // 5. Completed followups
          supabase.from('leads').select('*', { count: 'exact', head: true }).or(`followup_date.eq.${todayDateStr},followup_date.gte.${todayISO}`).eq('followup_notified', true),
          // 6. Today's tasks
          supabase.from('tasks').select('*', { count: 'exact', head: true }).or(`due_date.eq.${todayDateStr},created_at.gte.${todayISO}`),
          // 7. Completed tasks
          supabase.from('tasks').select('*', { count: 'exact', head: true }).or(`due_date.eq.${todayDateStr},created_at.gte.${todayISO}`).eq('status', 'completed'),
          // 8. Today's todos
          supabase.from('todos').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
          // 9. Completed todos
          supabase.from('todos').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).eq('status', 'completed'),
        ])

        const yCount = yesterdayLeadsRes.count || 0
        const tCount = todayLeadsRes.count || 0
        let leadIncrease = 0
        if (yCount === 0) {
          leadIncrease = tCount > 0 ? 100 : 0
        } else {
          leadIncrease = Number((((tCount - yCount) / yCount) * 100).toFixed(2))
        }

        setStats({
          leads: {
            total: tCount,
            completed: completedTodayLeadsRes.count || 0,
            increase: leadIncrease,
          },
          followups: {
            total: todayFollowupRes.count || 0,
            completed: completedFollowupRes.count || 0,
          },
          tasks: {
            total: todayTaskRes.count || 0,
            completed: completedTaskRes.count || 0,
          },
          todos: {
            total: todayTodoRes.count || 0,
            completed: completedTodoRes.count || 0,
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
      <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
              <Filter className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Leads</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.leads.total}</h3>
            </div>
          </div>
          <Filter className="w-8 h-8 text-green-100 opacity-50" />
        </div>
        <p className="text-xs text-green-500 font-medium mt-2">{stats.leads.increase}% Increase <span className="text-gray-400">vs Yesterday</span></p>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completed Lead</span>
          <span className="text-sm font-bold text-green-500">{stats.leads.total > 0 ? ((stats.leads.completed / stats.leads.total) * 100).toFixed(2) : 0}%</span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 mt-2 rounded-full overflow-hidden">
          <div className="bg-green-500 h-full" style={{ width: `${stats.leads.total > 0 ? (stats.leads.completed / stats.leads.total) * 100 : 0}%` }}></div>
        </div>
      </div>

      {/* Followups Card */}
      <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <Send className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Followups</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.followups.total}</h3>
            </div>
          </div>
          <Send className="w-8 h-8 text-red-100 opacity-50" />
        </div>
        <p className="text-xs text-red-500 font-medium mt-2">{stats.followups.completed} Completed <span className="text-gray-400">{stats.followups.total}</span></p>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completed Followup</span>
          <span className="text-sm font-bold text-red-500">{stats.followups.total > 0 ? ((stats.followups.completed / stats.followups.total) * 100).toFixed(2) : 100.00}%</span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 mt-2 rounded-full overflow-hidden">
          <div className="bg-red-500 h-full" style={{ width: `${stats.followups.total > 0 ? (stats.followups.completed / stats.followups.total) * 100 : 100}%` }}></div>
        </div>
      </div>

      {/* Tasks Card */}
      <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Tasks</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.tasks.total}</h3>
            </div>
          </div>
          <Calendar className="w-8 h-8 text-orange-100 opacity-50" />
        </div>
        <p className="text-xs text-orange-500 font-medium mt-2">{stats.tasks.completed} Completed <span className="text-gray-400">{stats.tasks.total}</span></p>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completed Task</span>
          <span className="text-sm font-bold text-orange-500">{stats.tasks.total > 0 ? ((stats.tasks.completed / stats.tasks.total) * 100).toFixed(2) : 100.00}%</span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 mt-2 rounded-full overflow-hidden">
          <div className="bg-orange-500 h-full" style={{ width: `${stats.tasks.total > 0 ? (stats.tasks.completed / stats.tasks.total) * 100 : 100}%` }}></div>
        </div>
      </div>

      {/* Todos Card */}
      <div className="bg-white dark:bg-gray-950 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center">
              <ListTodo className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Todos</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stats.todos.total}</h3>
            </div>
          </div>
          <ListTodo className="w-8 h-8 text-cyan-100 opacity-50" />
        </div>
        <p className="text-xs text-cyan-500 font-medium mt-2">{stats.todos.completed} Completed <span className="text-gray-400">{stats.todos.total}</span></p>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completed Todo</span>
          <span className="text-sm font-bold text-cyan-500">{stats.todos.total > 0 ? ((stats.todos.completed / stats.todos.total) * 100).toFixed(2) : 100.00}%</span>
        </div>
        <div className="w-full bg-gray-100 h-1.5 mt-2 rounded-full overflow-hidden">
          <div className="bg-cyan-500 h-full" style={{ width: `${stats.todos.total > 0 ? (stats.todos.completed / stats.todos.total) * 100 : 100}%` }}></div>
        </div>
      </div>
    </div>
  )
}
