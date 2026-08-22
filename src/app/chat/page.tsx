'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import ConversationList from '@/components/chat/ConversationList'
import ChatWindow from '@/components/chat/ChatWindow'
import LeadPanel from '@/components/chat/LeadPanel'
import { Conversation, Lead } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { MessageSquare, ArrowLeft, Info, Calendar } from 'lucide-react'

type MobileView = 'list' | 'chat' | 'lead'

export default function ChatPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="h-96 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <ChatContent />
      </Suspense>
    </DashboardLayout>
  )
}

function ChatContent() {
  const searchParams = useSearchParams()
  const conversationIdParam = searchParams?.get('conversation_id')

  const [selected, setSelected] = useState<Conversation | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [mobileView, setMobileView] = useState<MobileView>('list')
  const { profile } = useAuth()
  const [dueReminder, setDueReminder] = useState<{
    leadId: string
    leadName: string
    leadPhone: string
    conversationId: string
  } | null>(null)

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

  useEffect(() => {
    const targetId = searchParams?.get('conversation_id') || searchParams?.get('id')
    const targetPhone = searchParams?.get('phone')

    if (!targetId && !targetPhone) return

    const selectConversationFromParam = async () => {
      try {
        let conv = null

        // 1. Try finding by conversation id directly
        if (targetId) {
          const { data } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', targetId)
            .maybeSingle()
          if (data) conv = data
        }

        // 2. If not found by ID or if targetId was actually a lead record, search by phone
        if (!conv && (targetPhone || targetId)) {
          const rawPhone = targetPhone || targetId || ''
          const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10)
          if (cleanPhone) {
            const { data } = await supabase
              .from('conversations')
              .select('*')
              .ilike('phone_number', `%${cleanPhone}`)
              .limit(1)
              .maybeSingle()
            if (data) conv = data
          }
        }

        if (conv) {
          handleSelect(conv)
        }
      } catch (err) {
        console.error('Error selecting conversation from URL param:', err)
      }
    }

    selectConversationFromParam()
  }, [searchParams])

  // Sync selected conversation state with realtime updates
  useEffect(() => {
    if (!selected?.id) return

    const channelName = `selected-conv-${selected.id}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${selected.id}`,
        },
        (payload) => {
          const updated = payload.new as Conversation
          setSelected((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selected?.id])

  const handleLeadUpdate = (updates: Partial<Lead>) => {
    setLead((prev) => (prev ? { ...prev, ...updates } : null))
  }

  const handleDelete = (id: string) => {
    if (selected?.id === id) {
      setSelected(null)
      setMobileView('list')
    }
  }

  return (
    <div className="h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-115px)] flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
      {/* Mobile Sub-Header for switching between views */}
      <div className="md:hidden flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {mobileView !== 'list' && (
            <button
              onClick={() => setMobileView('list')}
              className="p-1 rounded-lg text-gray-600 hover:bg-gray-200 dark:text-gray-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <span className="font-bold text-xs text-gray-800 dark:text-gray-200">
            {mobileView === 'list' && 'All Chats'}
            {mobileView === 'chat' && (selected?.name || selected?.phone_number || 'Chat')}
            {mobileView === 'lead' && 'Lead Details'}
          </span>
        </div>

        {selected && mobileView === 'chat' && (
          <button
            onClick={() => setMobileView('lead')}
            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1"
          >
            <Info className="w-4 h-4" />
            <span>Lead Info</span>
          </button>
        )}
      </div>

      {/* Main 3-Pane Container */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Column: Conversation List */}
        <div
          className={`
            flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-800
            ${mobileView === 'list' ? 'flex w-full' : 'hidden'}
            md:flex md:w-80 md:shrink-0
          `}
        >
          <ConversationList
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        </div>

        {/* Middle Column: Chat Window */}
        <div
          className={`
            flex-1 flex flex-col overflow-hidden min-w-0
            ${mobileView === 'chat' ? 'flex' : 'hidden'}
            md:flex
          `}
        >
          <ChatWindow
            conversation={selected}
            onAIToggle={(id, mode) => {
              if (selected?.id === id)
                setSelected((prev) => (prev ? { ...prev, ai_mode: mode } : null))
            }}
            onStageChange={(id, newStage) => {
              if (selected?.id === id) {
                setSelected((prev) => (prev ? { ...prev, stage: newStage } : null))
                setLead((prev) => (prev ? { ...prev, stage: newStage } : null))
              }
            }}
          />
        </div>

        {/* Right Column: Lead Panel */}
        <div
          className={`
            flex flex-col overflow-hidden border-l border-gray-200 dark:border-gray-800
            ${mobileView === 'lead' ? 'flex w-full' : 'hidden'}
            md:flex md:w-80 md:shrink-0
          `}
        >
          <LeadPanel
            conversation={selected}
            lead={lead}
            onLeadUpdate={handleLeadUpdate}
          />
        </div>
      </div>

      {/* Floating Follow-up Notification */}
      {dueReminder && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-gray-900 border border-emerald-500 rounded-2xl p-4 shadow-2xl max-w-sm w-full animate-bounce">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Calendar className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 dark:text-white">Follow-up Reminder</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Follow up with <span className="font-semibold text-emerald-600">{dueReminder.leadName}</span>.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={async () => {
                    const { data: conv } = await supabase
                      .from('conversations')
                      .select('*')
                      .eq('id', dueReminder.conversationId)
                      .single()
                    if (conv) handleSelect(conv)
                    await supabase
                      .from('leads')
                      .update({ followup_notified: true })
                      .eq('id', dueReminder.leadId)
                    setDueReminder(null)
                  }}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium"
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
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs"
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
