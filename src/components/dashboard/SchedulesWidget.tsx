'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  Clock,
  Phone,
  MessageSquare,
  Bot,
  Calendar,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function SchedulesWidget() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'Reminder' | 'Meeting' | 'Events'>('Reminder')
  const [schedules, setSchedules] = useState<any[]>([])
  const [leadFollowups, setLeadFollowups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadAllSchedules = async () => {
    setLoading(true)
    try {
      const [schedRes, leadsRes, convsRes] = await Promise.all([
        supabase.from('schedules').select('*').order('scheduled_at', { ascending: true }),
        supabase
          .from('leads')
          .select('id, name, phone_number, conversation_id, stage, followup_date, followup_notes, followup_notified')
          .not('followup_date', 'is', null)
          .order('followup_date', { ascending: true })
          .limit(100),
        supabase
          .from('conversations')
          .select('id, name, phone_number, stage, notes')
          .limit(500),
      ])

      if (schedRes.data) setSchedules(schedRes.data)

      const convMap = new Map<string, any>()
      if (convsRes.data) {
        convsRes.data.forEach((c) => convMap.set(c.id, c))
      }

      if (leadsRes.data) {
        const enriched = leadsRes.data.map((l) => {
          const conv = l.conversation_id ? convMap.get(l.conversation_id) : null
          const rawNotes = l.followup_notes || ''
          const actionType = rawNotes.includes('[Manual Call]')
            ? 'manual'
            : rawNotes.includes('[WhatsApp]')
            ? 'whatsapp'
            : 'voice_ai'
          const cleanNotes = rawNotes.replace(/^\[(Voice AI|Manual Call|WhatsApp)\]\s*/i, '')

          return {
            id: l.id || l.conversation_id,
            conversation_id: l.conversation_id || l.id,
            name: l.name || conv?.name || (l.phone_number ? `Lead ${l.phone_number.slice(-4)}` : 'Customer'),
            phone_number: l.phone_number || conv?.phone_number,
            scheduled_at: l.followup_date,
            title: `Follow-up: ${l.name || conv?.name || 'Customer'}`,
            notes: cleanNotes || 'Scheduled follow-up reminder',
            action_type: actionType,
            type: 'reminder',
            isLeadFollowup: true,
          }
        })
        setLeadFollowups(enriched)
      }
    } catch (err) {
      console.error('Error loading schedules widget:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAllSchedules()

    const channel = supabase
      .channel(`schedules-widget-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => loadAllSchedules())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => loadAllSchedules())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const tabs: Array<'Reminder' | 'Meeting' | 'Events'> = ['Reminder', 'Meeting', 'Events']

  // Merge reminders from generic schedules and lead follow-ups
  const allReminders = [
    ...leadFollowups,
    ...schedules.filter((s) => s.type.toLowerCase() === 'reminder'),
  ].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const meetings = schedules.filter((s) => s.type.toLowerCase() === 'meeting')
  const events = schedules.filter((s) => s.type.toLowerCase() === 'event')

  const getItemsForTab = () => {
    if (activeTab === 'Reminder') return allReminders
    if (activeTab === 'Meeting') return meetings
    return events
  }

  const currentItems = getItemsForTab()

  const getCount = (tab: 'Reminder' | 'Meeting' | 'Events') => {
    if (tab === 'Reminder') return allReminders.length
    if (tab === 'Meeting') return meetings.length
    return events.length
  }

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col min-h-[320px]">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-800 dark:text-blue-400" />
          <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">Schedules</h3>
        </div>

        {/* Tab Filters */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {tabs.map((tab) => {
            const count = getCount(tab)
            const isSelected = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200 ring-1 ring-blue-400/40'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isSelected
                      ? 'bg-blue-700 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col overflow-hidden">
        {loading && currentItems.length === 0 ? (
          <div className="m-auto text-center py-10">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-semibold">Loading schedules...</p>
          </div>
        ) : currentItems.length > 0 ? (
          <div className="space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
            {currentItems.map((item) => {
              const dateObj = new Date(item.scheduled_at)
              const isValidDate = !isNaN(dateObj.getTime())
              const formattedDate = isValidDate
                ? dateObj.toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })
                : item.scheduled_at

              const actionType = item.action_type || 'voice_ai'

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.isLeadFollowup) {
                      const cid = item.conversation_id || item.id
                      const phone = item.phone_number ? encodeURIComponent(item.phone_number) : ''
                      router.push(`/chat?conversation_id=${cid}&phone=${phone}`)
                    }
                  }}
                  className="p-3 border border-gray-100 dark:border-gray-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-800/80 cursor-pointer transition-all group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 transition-colors">
                        {item.name || item.title}
                      </span>

                      {item.isLeadFollowup && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${
                            actionType === 'voice_ai'
                              ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-900'
                              : actionType === 'whatsapp'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                          }`}
                        >
                          {actionType === 'voice_ai' && <Bot className="w-3 h-3 text-purple-600" />}
                          {actionType === 'whatsapp' && <MessageSquare className="w-3 h-3 text-emerald-600" />}
                          {actionType === 'manual' && <Phone className="w-3 h-3 text-amber-600" />}
                          <span>
                            {actionType === 'voice_ai'
                              ? 'Voice AI Auto-Call'
                              : actionType === 'whatsapp'
                              ? 'WhatsApp Follow-up'
                              : 'Manual Call'}
                          </span>
                        </span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-md">
                        {item.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <span className="text-[11px] font-mono font-semibold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-100 dark:border-gray-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-500" />
                      <span>{formattedDate}</span>
                    </span>

                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all hidden sm:block" />
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="m-auto text-center opacity-40 text-gray-400 dark:text-gray-500 py-8">
            <Bell className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="text-xs font-bold">There Are No Schedules to Display</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Set a follow-up reminder from any lead to view it here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
