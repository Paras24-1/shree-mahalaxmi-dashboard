'use client'

import React from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import { BarChart3, TrendingUp, Users, MessageSquare } from 'lucide-react'

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Business Reports</h1>
          <p className="text-xs text-gray-500">Analytics, revenue, lead conversion rates, and team performance</p>
        </div>
        <Link href="/analytics" className="px-4 py-2 bg-[#2E285F] text-white text-xs font-bold rounded-xl shadow-sm">
          Open Full Analytics
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Lead Conversion</h3>
          <p className="text-xs text-gray-500">32% of incoming WhatsApp leads converted into booked orders.</p>
        </div>
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-2">
          <TrendingUp className="w-6 h-6 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Revenue Growth</h3>
          <p className="text-xs text-gray-500">+24.5% increase in machinery sales compared to last month.</p>
        </div>
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-2">
          <Users className="w-6 h-6 text-purple-600" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Response Time</h3>
          <p className="text-xs text-gray-500">Average response time is under 1.2 minutes with AI Assistant mode.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
