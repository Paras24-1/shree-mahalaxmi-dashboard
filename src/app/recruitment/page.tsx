'use client'

import React from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { UserCheck, Plus, Briefcase } from 'lucide-react'

export default function RecruitmentPage() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Recruitment</h1>
          <p className="text-xs text-gray-500">Track candidates, interviews, and hiring pipeline</p>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center shadow-sm">
        <UserCheck className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-500">No active job openings currently</p>
      </div>
    </DashboardLayout>
  )
}
