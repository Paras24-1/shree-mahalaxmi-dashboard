'use client'

import { useState, useEffect } from 'react'
import { CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function TasksWidget() {
  const [activeTab, setActiveTab] = useState('Today')
  const [tasks, setTasks] = useState<any[]>([])

  useEffect(() => {
    async function loadTasks() {
      const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
      if (data) setTasks(data)
    }
    loadTasks()
  }, [])

  const tabs = ['Today', 'Tomorrow']

  const filteredTasks = tasks.filter(t => t.due_date === activeTab.toLowerCase())

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col min-h-[300px]">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-blue-800" />
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Tasks</h3>
        
        <div className="ml-4 flex gap-2">
          {tabs.map(tab => {
            const count = tasks.filter(t => t.due_date === tab.toLowerCase()).length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1 text-xs font-semibold rounded-full transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
              <li key={task.id} className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium">{task.title}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${task.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {task.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="m-auto text-center opacity-30">
            <CalendarDays className="w-16 h-16 mx-auto mb-2" />
            <p className="text-sm font-bold">There Are No Tasks to Display</p>
          </div>
        )}
      </div>
    </div>
  )
}
