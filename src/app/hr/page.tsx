'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Users, Plus, UserCheck, Shield, Mail, Phone } from 'lucide-react'

export default function HRPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setUsers(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">HR & Team Operations</h1>
          <p className="text-xs text-gray-500">Manage employees, roles, and CRM access permissions</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 font-bold text-xs uppercase text-gray-500">
          Team Members ({users.length})
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
          {users.map((u: any) => (
            <div key={u.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-850">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                  {u.name?.slice(0, 2).toUpperCase() || 'U'}
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{u.name}</div>
                  <div className="text-[11px] text-gray-400 font-mono">{u.email}</div>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {u.role || 'employee'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
