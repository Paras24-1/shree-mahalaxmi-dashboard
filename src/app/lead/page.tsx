'use client'

import { Suspense } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LeadHeader from '@/components/lead/LeadHeader'
import LeadBoard from '@/components/lead/LeadBoard'

export default function LeadPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <LeadBoard />
        </Suspense>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 font-medium">COPYRIGHT © 2026 VoxAI, All rights Reserved</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
