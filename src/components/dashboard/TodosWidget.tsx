'use client'

import { useState, useEffect } from 'react'
import { ListTodo } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function TodosWidget() {
  const [activeTab, setActiveTab] = useState('High')
  const [todos, setTodos] = useState<any[]>([])

  useEffect(() => {
    async function loadTodos() {
      const { data } = await supabase.from('todos').select('*').order('created_at', { ascending: false })
      if (data) setTodos(data)
    }
    loadTodos()
  }, [])

  const tabs = ['High', 'Medium', 'Low']

  const filteredTodos = todos.filter(t => t.priority === activeTab.toLowerCase())

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col min-h-[300px]">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <ListTodo className="w-5 h-5 text-blue-800 dark:text-blue-400" />
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Todos</h3>
        
        <div className="ml-4 flex gap-2">
          {tabs.map(tab => {
            const count = todos.filter(t => t.priority === tab.toLowerCase()).length
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
        {filteredTodos.length > 0 ? (
          <ul className="space-y-2">
            {filteredTodos.map(todo => (
              <li key={todo.id} className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg flex items-center justify-between bg-white dark:bg-gray-900">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{todo.title}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  todo.status === 'completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                }`}>
                  {todo.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="m-auto text-center opacity-30 text-gray-400 dark:text-gray-500">
            <ListTodo className="w-16 h-16 mx-auto mb-2" />
            <p className="text-sm font-bold">There Are No Todos to Display</p>
          </div>
        )}
      </div>
    </div>
  )
}
