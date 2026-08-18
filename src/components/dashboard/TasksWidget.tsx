'use client'

import { useState, useEffect } from 'react'
import { CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function TasksWidget() {
  const [activeTab, setActiveTab] = useState('Today')
  const [tasks, setTasks] = useState<any[]>([])

  useEffect(() => {
    async function loadTasks() {
      const { data } = await supabase.from('tasks').select('*').order('due_date', { ascending: true }).limit(20)
      if (data) setTasks(data)
    }
    loadTasks()
  }, [])

  const tabs = ['Today', 'Tomorrow', 'All']

  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

  const getFilteredTasks = (tab: string) => {
    if (tab === 'Today') {
      return tasks.filter(t => t.due_date === todayStr || (!t.due_date && t.created_at?.startsWith(todayStr)))
    }
    if (tab === 'Tomorrow') {
      return tasks.filter(t => t.due_date === tomorrowStr)
    }
    return tasks
  }

  const filteredTasks = getFilteredTasks(activeTab)

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col min-h-[300px]">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-blue-800 dark:text-blue-400" />
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Tasks</h3>
        
        <div className="ml-4 flex gap-2">
          {tabs.map(tab => {
            const count = getFilteredTasks(tab).length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1 text-xs font-semibold rounded-full transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {tab} ({count})
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        {filteredTasks.length > 0 ? (
          <ul className="space-y-2">
            {filteredTasks.map(task => (
              <li key={task.id} className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg flex items-center justify-between bg-white dark:bg-gray-900">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  task.status === 'completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                }`}>
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="m-auto text-center opacity-30 text-gray-400 dark:text-gray-500">
            <CalendarDays className="w-16 h-16 mx-auto mb-2" />
            <p className="text-sm font-bold">There Are No Tasks to Display</p>
          </div>
        )}
      </div>
    </div>
  )
}
