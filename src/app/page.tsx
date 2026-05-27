'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ProtectedRoute from '@/components/ProtectedRoute'
import ConversationList from '@/components/chat/ConversationList'
import ChatWindow from '@/components/chat/ChatWindow'
import LeadPanel from '@/components/chat/LeadPanel'
import AdminPanel from '@/components/admin/AdminPanel'
import { Conversation, Lead } from '@/types'
import { MessageSquare, Moon, Sun, ArrowLeft, Info, Send, Users, LogOut, BarChart3, Calendar } from 'lucide-react'
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
  const [dueReminder, setDueReminder] = useState<{
    leadId: string
    leadName: string
    leadPhone: string
    conversationId: string
  } | null>(null)
  
  const activeTimersRef = useRef<{ [leadId: string]: NodeJS.Timeout }>({})

  const triggerNotification = (leadId: string, leadName: string, leadPhone: string, conversationId: string) => {
    // 1. Audio chime using Web Audio API (zero asset dependency)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } catch {}

    // 2. Set visual alert state
    setDueReminder({
      leadId,
      leadName,
      leadPhone,
      conversationId
    })
  }

  const scheduleReminder = (
    leadId: string,
    followupDateStr: string,
    leadName: string,
    leadPhone: string,
    conversationId: string
  ) => {
    if (activeTimersRef.current[leadId]) {
      clearTimeout(activeTimersRef.current[leadId])
    }

    const delay = new Date(followupDateStr).getTime() - Date.now()
    if (delay <= 0) return

    const timer = setTimeout(() => {
      triggerNotification(leadId, leadName, leadPhone, conversationId)
    }, delay)

    activeTimersRef.current[leadId] = timer
  }

  // Load and manage reminders
  useEffect(() => {
    if (!profile?.id) return

    const loadReminders = async () => {
      try {
        // 1. Get conversations assigned to this user
        const { data: convs } = await supabase
          .from('conversations')
          .select('id, name, phone_number')
          .eq('assigned_to', profile.id)

        if (!convs || convs.length === 0) return

        const convIds = convs.map((c) => c.id)

        // 2. Get leads with active followup_date in the future (or past and not notified)
        const { data: leads } = await supabase
          .from('leads')
          .select('*')
          .in('conversation_id', convIds)
          .not('followup_date', 'is', null)
          .or('followup_notified.is.null,followup_notified.eq.false')

        if (!leads) return

        leads.forEach((l) => {
          const matchedConv = convs.find((c) => c.id === l.conversation_id)
          if (!matchedConv || !l.followup_date) return

          const delay = new Date(l.followup_date).getTime() - Date.now()
          if (delay <= 0) {
            const isRecent = Math.abs(delay) < 24 * 60 * 60 * 1000 // 24 hours
            if (isRecent && l.id) {
              triggerNotification(
                l.id,
                matchedConv.name || matchedConv.phone_number,
                matchedConv.phone_number,
                matchedConv.id
              )
            }
          } else if (l.id) {
            scheduleReminder(
              l.id,
              l.followup_date,
              matchedConv.name || matchedConv.phone_number,
              matchedConv.phone_number,
              matchedConv.id
            )
          }
        })
      } catch (err) {
        console.error('Error loading reminders:', err)
      }
    }

    loadReminders()

    // Subscribe to realtime changes in leads table
    const leadsChannel = supabase
      .channel('leads-changes-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        async (payload) => {
          const newLead = payload.new as Lead
          if (!newLead || !newLead.conversation_id || !newLead.id) return

          // Fetch the conversation info to check assignment
          const { data: conv } = await supabase
            .from('conversations')
            .select('id, name, phone_number, assigned_to')
            .eq('id', newLead.conversation_id)
            .single()

          if (!conv || conv.assigned_to !== profile?.id) {
            // Clear timer if unassigned or assigned to someone else
            if (activeTimersRef.current[newLead.id]) {
              clearTimeout(activeTimersRef.current[newLead.id])
              delete activeTimersRef.current[newLead.id]
            }
            return
          }

          if (payload.eventType === 'DELETE' || !newLead.followup_date || newLead.followup_notified) {
            // Clear reminder
            if (activeTimersRef.current[newLead.id]) {
              clearTimeout(activeTimersRef.current[newLead.id])
              delete activeTimersRef.current[newLead.id]
            }
            return
          }

          // Schedule or reschedule
          const delay = new Date(newLead.followup_date).getTime() - Date.now()
          if (delay <= 0) {
            triggerNotification(
              newLead.id,
              conv.name || conv.phone_number,
              conv.phone_number,
              conv.id
            )
          } else {
            scheduleReminder(
              newLead.id,
              newLead.followup_date,
              conv.name || conv.phone_number,
              conv.phone_number,
              conv.id
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(leadsChannel)
    }
  }, [profile?.id])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(activeTimersRef.current).forEach(clearTimeout)
    }
  }, [])

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

      {/* Follow-up Reminder Floating Alert Toast */}
      {dueReminder && (
        <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-900 border border-emerald-500 rounded-2xl p-4 shadow-2xl max-w-sm w-full animate-bounce">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Calendar className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-white">Follow-up Reminder</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                It's time to follow up with <span className="font-semibold text-emerald-600 dark:text-emerald-400">{dueReminder.leadName}</span> ({dueReminder.leadPhone}).
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={async () => {
                    const { data: conv } = await supabase
                      .from('conversations')
                      .select('*')
                      .eq('id', dueReminder.conversationId)
                      .single()
                    if (conv) {
                      handleSelect(conv)
                    }
                    await supabase
                      .from('leads')
                      .update({ followup_notified: true })
                      .eq('id', dueReminder.leadId)
                    setDueReminder(null)
                  }}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  Go to Chat
                </button>
                <button
                  onClick={async () => {
                    await supabase
                      .from('leads')
                      .update({ followup_notified: true })
                      .eq('id', dueReminder.leadId)
                    setDueReminder(null)
                  }}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
