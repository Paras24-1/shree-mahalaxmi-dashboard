'use client'

import DashboardLayout from '@/components/layout/DashboardLayout'
import StatCards from '@/components/dashboard/StatCards'
import LeadsWidget from '@/components/dashboard/LeadsWidget'
import SchedulesWidget from '@/components/dashboard/SchedulesWidget'
import TasksWidget from '@/components/dashboard/TasksWidget'
import TodosWidget from '@/components/dashboard/TodosWidget'
import StickyNotesWidget from '@/components/dashboard/StickyNotesWidget'

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <StatCards />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <LeadsWidget />
            <TasksWidget />
          </div>
          
          <div className="space-y-6">
            <SchedulesWidget />
            <TodosWidget />
          </div>
        </div>

        <div className="w-full">
          <StickyNotesWidget />
        </div>
      </div>
    </DashboardLayout>
  )
}
