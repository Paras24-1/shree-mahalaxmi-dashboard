'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function SchedulesWidget() {
  const [activeTab, setActiveTab] = useState('Reminder')
  const [schedules, setSchedules] = useState<any[]>([])

  useEffect(() => {
    async function loadSchedules() {
      const { data } = await supabase.from('schedules').select('*').order('scheduled_at', { ascending: true })
      if (data) setSchedules(data)
    }
    loadSchedules()
  }, [])

  const tabs = ['Reminder', 'Meeting', 'Events']

  const filteredSchedules = schedules.filter(s => s.type.toLowerCase() === activeTab.toLowerCase().replace(/s$/, ''))

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col min-h-[300px]">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <Bell className="w-5 h-5 text-blue-800 dark:text-blue-400" />
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Schedules</h3>
        
        <div className="ml-4 flex gap-2">
          {tabs.map(tab => {
            const count = schedules.filter(s => s.type.toLowerCase() === tab.toLowerCase().replace(/s$/, '')).length
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
         {filteredSchedules.length > 0 ? (
          <ul className="space-y-3">
            {filteredSchedules.map(schedule => (
              <li key={schedule.id} className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg flex items-center justify-between shadow-2xs bg-white dark:bg-gray-900">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{schedule.title}</span>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  {new Date(schedule.scheduled_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="m-auto text-center opacity-30 text-gray-400 dark:text-gray-500">
            <Bell className="w-16 h-16 mx-auto mb-2" />
            <p className="text-sm font-bold">There Are No Schedules to Display</p>
          </div>
        )}
      </div>
    </div>
  )
}
