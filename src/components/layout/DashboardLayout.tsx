'use client'

import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen w-full overflow-hidden bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0 relative">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
