'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import LeadHeader from '@/components/lead/LeadHeader'
import LeadBoard from '@/components/lead/LeadBoard'

export default function LeadPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
        <LeadHeader />
        <LeadBoard />
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 font-medium">COPYRIGHT © 2026 VoxAI, All rights Reserved</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
