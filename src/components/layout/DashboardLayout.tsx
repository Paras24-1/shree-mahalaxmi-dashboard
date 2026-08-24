'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import ProtectedRoute from '@/components/ProtectedRoute'
import FollowupRunner from '@/components/common/FollowupRunner'
import {
  LayoutDashboard,
  Filter,
  MessageSquare,
  Clock,
  BarChart3,
  Menu,
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Automatically close mobile sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  const isChat = pathname === '/chat'

  const mobileNav = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Leads', href: '/lead', icon: Filter },
    { name: 'Chat', href: '/chat', icon: MessageSquare },
    { name: 'Follow-ups', href: '/reminder', icon: Clock },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
  ]

  return (
    <ProtectedRoute>
      <FollowupRunner />
      <div className="fixed inset-0 flex w-full h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0 w-full h-full">
          <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
          <main
            className={`flex-1 overflow-y-auto p-2.5 sm:p-4 md:p-6 min-h-0 relative w-full ${
              isChat ? 'pb-2 sm:pb-4' : 'pb-20 md:pb-6'
            }`}
          >
            {children}
          </main>

          {/* Mobile Bottom Navigation Bar (Fixed for phone screens) */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 flex items-center justify-around py-1.5 px-1 shadow-lg safe-bottom">
            {mobileNav.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[52px] ${
                    isActive
                      ? 'text-indigo-900 dark:text-indigo-400 font-bold'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                  }`}
                >
                  <item.icon className={`w-4 h-4 mb-0.5 ${isActive ? 'scale-110' : ''}`} />
                  <span className="text-[10px] leading-tight tracking-tight">{item.name}</span>
                </Link>
              )
            })}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[52px] text-gray-500 dark:text-gray-400 hover:text-gray-900"
            >
              <Menu className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] leading-tight tracking-tight">Menu</span>
            </button>
          </nav>
        </div>
      </div>
    </ProtectedRoute>
  )
}

