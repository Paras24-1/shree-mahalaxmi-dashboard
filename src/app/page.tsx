'use client'

import { useState, useEffect } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import ConversationList from '@/components/chat/ConversationList'
import ChatWindow from '@/components/chat/ChatWindow'
import LeadPanel from '@/components/chat/LeadPanel'
import AdminPanel from '@/components/admin/AdminPanel'
import { Conversation, Lead } from '@/types'
import { MessageSquare, Moon, Sun, ArrowLeft, Info, Send, Users, LogOut, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

type MobileView = 'list' | 'chat' | 'lead'

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}

function DashboardContent() {
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [dark, setDark] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('list')
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const { profile, signOut } = useAuth()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const handleSelect = async (conv: Conversation) => {
    setSelected(conv)
    setMobileView('chat')
    try {
      const res = await fetch(`/api/leads?conversation_id=${conv.id}`)
      if (res.ok) {
        const data = await res.json()
        setLead(data && data.id ? data : null)
      }
    } catch {
      setLead(null)
    }
  }

  const handleLeadUpdate = (updates: Partial<Lead>) => {
    setLead((prev) => prev ? { ...prev, ...updates } : null)
  }

  const handleDelete = (id: string) => {
    if (selected?.id === id) {
      setSelected(null)
      setMobileView('list')
    }
  }

  const handleLogout = async () => {
    await signOut()
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-gray-950">
      {/* Admin Panel Modal */}
      {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

      {/* Top bar */}
      <header className="h-12 flex items-center justify-between px-4 bg-emerald-600 shrink-0 z-10">
        <div className="flex items-center gap-2">
          {mobileView !== 'list' && (
            <button
              onClick={() => setMobileView(mobileView === 'lead' ? 'chat' : 'list')}
              className="mr-1 p-1 rounded-lg text-emerald-100 hover:bg-emerald-700 md:hidden"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <MessageSquare className="w-5 h-5 text-white" />
          <span className="text-white font-semibold text-sm">
            {mobileView === 'list' && 'Shree Mahalaxmi CRM'}
            {mobileView === 'chat' && (selected?.name || 'Chat')}
            {mobileView === 'lead' && 'Lead Info'}
          </span>
          <span className="hidden md:inline-block ml-2 px-2 py-0.5 bg-emerald-700 text-emerald-100 text-xs rounded-full">
            {isAdmin ? 'Admin' : 'Employee'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {mobileView === 'chat' && selected && (
            <button
              onClick={() => setMobileView('lead')}
              className="p-1.5 rounded-lg text-emerald-100 hover:bg-emerald-700 md:hidden"
              title="View lead info"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
          {isAdmin && (
            <>
              <Link
                href="/analytics"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Analytics</span>
              </Link>
              <button
                onClick={() => setShowAdminPanel(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Manage Team</span>
              </button>
            </>
          )}
          <Link
            href="/bulk"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden md:block">Bulk Message</span>
          </Link>
          <button
            onClick={() => setDark((d) => !d)}
            className="p-1.5 rounded-lg text-emerald-100 hover:bg-emerald-700 transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-emerald-100 hover:bg-emerald-700 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={`
          flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-800
          ${mobileView === 'list' ? 'flex' : 'hidden'}
          md:flex md:w-80 md:shrink-0 w-full
        `}>
          <ConversationList
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        </div>

        <div className={`
          flex-1 flex flex-col overflow-hidden min-w-0
          ${mobileView === 'chat' ? 'flex' : 'hidden'}
          md:flex
        `}>
          <ChatWindow
            conversation={selected}
            onAIToggle={(id, mode) => {
              if (selected?.id === id)
                setSelected((prev) => prev ? { ...prev, ai_mode: mode } : null)
            }}
          />
        </div>

        <div className={`
          flex flex-col overflow-hidden border-l border-gray-200 dark:border-gray-800
          ${mobileView === 'lead' ? 'flex' : 'hidden'}
          md:flex md:w-72 md:shrink-0 w-full
        `}>
          <LeadPanel
            conversation={selected}
            lead={lead}
            onLeadUpdate={handleLeadUpdate}
          />
        </div>
      </div>

      {selected && (
        <div className="md:hidden flex border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
          <button
            onClick={() => setMobileView('list')}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mobileView === 'list'
                ? 'text-emerald-600 border-t-2 border-emerald-500'
                : 'text-gray-500'
            }`}
          >
            Inbox
          </button>
          <button
            onClick={() => setMobileView('chat')}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mobileView === 'chat'
                ? 'text-emerald-600 border-t-2 border-emerald-500'
                : 'text-gray-500'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setMobileView('lead')}
            className={`flex-1 py-3 text-xs font-medium transition-colors ${
              mobileView === 'lead'
                ? 'text-emerald-600 border-t-2 border-emerald-500'
                : 'text-gray-500'
            }`}
          >
            Lead Info
          </button>
        </div>
      )}
    </div>
  )
}
