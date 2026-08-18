'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Filter,
  Clock,
  CalendarDays,
  MessageSquare,
  CheckSquare,
  ListTodo,
  StickyNote,
  Calendar,
  Users,
  FileText,
  Megaphone,
} from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()

  const navGroups = [
    {
      title: 'MAIN',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Lead', href: '/lead', icon: Filter, color: 'text-orange-500' },
        { name: 'Reminder', href: '/reminder', icon: Clock, color: 'text-red-500' },
        { name: 'Meeting', href: '/meeting', icon: CalendarDays, color: 'text-orange-600' },
        { name: 'Chat', href: '/chat', icon: MessageSquare, color: 'text-green-500' },
      ],
    },
    {
      title: 'PRODUCTIVITY',
      items: [
        { name: 'Task', href: '/task', icon: CheckSquare, color: 'text-gray-400' },
        { name: 'To Do', href: '/todo', icon: ListTodo, color: 'text-blue-400' },
        { name: 'Notes', href: '/notes', icon: StickyNote, color: 'text-red-500' },
        { name: 'Calendar', href: '/calendar', icon: Calendar, color: 'text-red-400' },
      ],
    },
    {
      title: 'BUSINESS',
      items: [
        { name: 'Customer', href: '/customer', icon: Users, color: 'text-orange-400' },
        { name: 'Invoice', href: '/invoice', icon: FileText, color: 'text-orange-500' },
        { name: 'Campaign', href: '/campaign', icon: Megaphone, color: 'text-purple-500' },
      ],
    },
  ]

  return (
    <aside className="w-64 h-full bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto">
      <div className="p-4 flex items-center justify-between">
        {/* Logo Mock */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-900 rounded text-white flex items-center justify-center font-bold text-sm">
            365
          </div>
          <span className="font-extrabold text-blue-900 text-xl tracking-tight">CRM</span>
          <span className="text-pink-500 font-bold ml-[-2px]">/</span>
        </div>
        <div className="w-6 h-6 border border-gray-300 rounded-full flex items-center justify-center cursor-pointer">
          <span className="text-gray-500 text-xs">◎</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-[11px] font-bold text-blue-900 mb-2">{group.title}</h3>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (pathname === '/dashboard' && item.href === '/')
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-900 to-pink-500 text-white font-medium shadow-md'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : item.color || 'text-gray-500'}`} />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs font-bold text-red-600">Platinum : 364 Days Left</p>
        <button className="text-xs text-blue-800 hover:underline mt-1">click to upgrade</button>
      </div>
    </aside>
  )
}
