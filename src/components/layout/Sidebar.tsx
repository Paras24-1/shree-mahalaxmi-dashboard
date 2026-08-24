'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
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
  ChevronDown,
  UserCheck,
  BarChart3,
  Circle,
  Mic,
} from 'lucide-react'

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()
  const [invoiceOpen, setInvoiceOpen] = useState(true)
  const [hrOpen, setHrOpen] = useState(false)

  useEffect(() => {
    if (pathname.startsWith('/invoice')) {
      setInvoiceOpen(true)
    }
  }, [pathname])

  const navGroups = [
    {
      title: 'MAIN',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Voice AI', href: '/analytics', icon: Mic, color: 'text-violet-500' },
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
        {
          name: 'Invoice',
          href: '/invoice',
          icon: FileText,
          color: 'text-orange-500',
          subItems: [
            { name: 'List', href: '/invoice' },
            { name: 'Add', href: '/invoice/add' },
            { name: 'Quotation', href: '/invoice/quotation' },
            { name: 'Payment Method', href: '/invoice/payment-method' },
            { name: 'Brochure', href: '/invoice/brochure' },
          ],
        },
        { name: 'Campaign', href: '/campaign', icon: Megaphone, color: 'text-purple-500' },
      ],
    },
    {
      title: 'TEAM OPERATIONS',
      items: [
        { name: 'HR', href: '/hr', icon: Users, color: 'text-orange-500' },
        { name: 'Recruitment', href: '/recruitment', icon: UserCheck, color: 'text-blue-500' },
        { name: 'Reports', href: '/reports', icon: BarChart3, color: 'text-cyan-500' },
      ],
    },
  ]

  const content = (
    <div className="flex flex-col h-full overflow-y-auto bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-auto px-1.5 h-8 bg-blue-900 rounded text-white flex items-center justify-center font-bold text-sm">
            Vox
          </div>
          <span className="font-extrabold text-blue-900 text-xl tracking-tight">AI</span>
          <span className="text-pink-500 font-bold ml-[-2px]">/</span>
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Close Menu"
              aria-label="Close Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <div className="w-6 h-6 border border-gray-300 rounded-full hidden md:flex items-center justify-center cursor-pointer">
            <span className="text-gray-500 text-xs">◎</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-5">
        {navGroups.map((group) => (
          <div key={group.title}>
            <h3 className="text-[11px] font-bold text-blue-900 dark:text-blue-400 mb-2 tracking-wider">{group.title}</h3>
            <ul className="space-y-1">
              {group.items.map((item: any) => {
                const hasSubItems = item.subItems && item.subItems.length > 0
                const isGroupActive = pathname === item.href || pathname.startsWith(item.href + '/')
                const isOpen = item.name === 'Invoice' ? invoiceOpen : (item.name === 'HR' ? hrOpen : false)

                if (hasSubItems) {
                  return (
                    <li key={item.name} className="space-y-1">
                      <div
                        onClick={() => {
                          if (item.name === 'Invoice') setInvoiceOpen(!invoiceOpen)
                          if (item.name === 'HR') setHrOpen(!hrOpen)
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors ${
                          isGroupActive && !isOpen
                            ? 'bg-gradient-to-r from-blue-900 to-pink-500 text-white shadow-md'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className={`w-4 h-4 ${isGroupActive && !isOpen ? 'text-white' : item.color || 'text-gray-500'}`} />
                          <span>{item.name}</span>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-gray-500' : 'text-gray-400'
                          }`}
                        />
                      </div>

                      {/* Sub-items menu */}
                      {isOpen && (
                        <ul className="pl-4 space-y-0.5 border-l-2 border-gray-100 dark:border-gray-800 ml-4 py-1">
                          {item.subItems.map((sub: any) => {
                            const isSubActive = pathname === sub.href
                            return (
                              <li key={sub.name}>
                                <Link
                                  href={sub.href}
                                  onClick={() => onClose?.()}
                                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    isSubActive
                                      ? 'bg-gradient-to-r from-blue-900 to-pink-500 text-white shadow-sm font-bold'
                                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800/60'
                                  }`}
                                >
                                  <Circle className={`w-2 h-2 ${isSubActive ? 'fill-current text-white' : 'text-gray-400'}`} />
                                  <span>{sub.name}</span>
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                }

                const isActive = pathname === item.href || (pathname === '/dashboard' && item.href === '/')
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => onClose?.()}
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
        <button className="text-xs text-blue-800 dark:text-blue-400 hover:underline mt-1">click to upgrade</button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-full shrink-0 flex-col">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          />
          {/* Slide-in Drawer */}
          <aside className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            {content}
          </aside>
        </div>
      )}
    </>
  )
}
