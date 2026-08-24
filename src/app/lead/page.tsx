'use client'

import { Suspense } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LeadHeader from '@/components/lead/LeadHeader'
import LeadBoard from '@/components/lead/LeadBoard'

export default function LeadPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col h-full overflow-hidden bg-transparent max-w-7xl mx-auto w-full">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center py-24">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <LeadBoard />
        </Suspense>
      </div>
    </DashboardLayout>
  )
}
