'use client'

import { useState } from 'react'
import { Filter, CalendarDays, Clock, CheckSquare, ListTodo, StickyNote, FileText, Search, Moon, Sun, Bell } from 'lucide-react'

export default function Topbar() {
  const [dark, setDark] = useState(false)

  const toggleTheme = () => {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <header className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-sm font-medium text-gray-600 dark:text-gray-400">
          <button className="flex items-center gap-1 hover:text-orange-500 transition-colors"><Filter className="w-4 h-4 text-orange-500" /> Lead</button>
          <span className="text-gray-300">|</span>
          <button className="flex items-center gap-1 hover:text-gray-900 transition-colors"><CalendarDays className="w-4 h-4 text-gray-400" /> Task</button>
          <span className="text-gray-300">|</span>
          <button className="flex items-center gap-1 hover:text-red-500 transition-colors"><Clock className="w-4 h-4 text-red-500" /> Reminder</button>
          <span className="text-gray-300">|</span>
          <button className="flex items-center gap-1 hover:text-orange-600 transition-colors"><CalendarDays className="w-4 h-4 text-orange-600" /> Meeting</button>
          <span className="text-gray-300">|</span>
          <button className="flex items-center gap-1 hover:text-blue-500 transition-colors"><ListTodo className="w-4 h-4 text-blue-500" /> To Do</button>
          <span className="text-gray-300">|</span>
          <button className="flex items-center gap-1 hover:text-red-500 transition-colors"><StickyNote className="w-4 h-4 text-red-500" /> Note</button>
          <span className="text-gray-300">|</span>
          <button className="flex items-center gap-1 hover:text-orange-400 transition-colors"><FileText className="w-4 h-4 text-orange-400" /> Invoice</button>
          <span className="text-gray-300">|</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-1.5 text-blue-500 hover:bg-gray-100 rounded-lg">
          <CheckSquare className="w-5 h-5" />
        </button>
        <button className="p-1.5 text-orange-400 hover:bg-gray-100 rounded-lg">
          <FileText className="w-5 h-5" />
        </button>
        <button className="p-1.5 text-pink-500 hover:bg-gray-100 rounded-lg">
          <Search className="w-5 h-5" />
        </button>
        <button onClick={toggleTheme} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg">
          {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button className="relative p-1.5 text-red-500 hover:bg-gray-100 rounded-lg">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            9
          </span>
        </button>

        <div className="flex items-center gap-3 border-l border-gray-200 pl-4 ml-2">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Shri Mahalaxmi Enterprises</p>
            <p className="text-xs text-gray-500">Store</p>
          </div>
          <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
        </div>
      </div>
    </header>
  )
}
