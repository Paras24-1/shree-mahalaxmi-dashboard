'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, Phone, MessageSquare, ArrowRight, ExternalLink, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getLeadColumn } from '@/components/lead/LeadBoard'
import { calculateLeadScore } from '@/lib/leadScoring'

export default function LeadsWidget() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('Today')
  const [leads, setLeads] = useState<any[]>([])

  useEffect(() => {
    async function loadLeads() {
      try {
        const [leadsRes, convsRes] = await Promise.all([
          supabase.from('leads').select('*').order('created_at', { ascending: false }),
          supabase.from('conversations').select('id, name, phone_number, stage, last_message, created_at, updated_at').order('updated_at', { ascending: false }),
        ])

        const leadMap = new Map<string, any>()
        if (convsRes.data) {
          convsRes.data.forEach((c) => {
            leadMap.set(c.id, {
              id: c.id,
              conversation_id: c.id,
              name: c.name || c.phone_number,
              phone_number: c.phone_number,
              stage: c.stage || 'new',
              source: 'WhatsApp CRM',
              last_message: c.last_message || null,
              created_at: c.created_at || c.updated_at,
            })
          })
        }
        if (leadsRes.data) {
          leadsRes.data.forEach((l) => {
            const key = l.conversation_id || l.id
            const existing = leadMap.get(key)
            leadMap.set(key, {
              ...existing,
              ...l,
              id: l.id || existing?.id,
              stage: l.stage || existing?.stage || 'new',
            })
          })
        }

        setLeads(Array.from(leadMap.values()))
      } catch (err) {
        console.error('Error loading dashboard leads:', err)
      }
    }
    loadLeads()
  }, [])

  const tabs = ['Today', 'New', 'Interested', 'Processing']

  const getFilteredLeads = (tab: string) => {
    if (tab === 'Today') {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
      return leads.filter((l) => {
        if (!l.created_at) return false
        return new Date(l.created_at).getTime() >= startOfToday
      })
    }
    if (tab === 'New') {
      return leads.filter((l) => getLeadColumn(l.stage, l.created_at) === 'new')
    }
    if (tab === 'Interested') {
      return leads.filter((l) => getLeadColumn(l.stage, l.created_at) === 'interested')
    }
    if (tab === 'Processing') {
      return leads.filter((l) => getLeadColumn(l.stage, l.created_at) === 'processing')
    }
    return leads
  }

  const handleOpenChat = (lead: any) => {
    const targetId = lead.conversation_id || lead.id || ''
    const phone = lead.phone_number ? encodeURIComponent(lead.phone_number) : ''
    router.push(`/chat?conversation_id=${targetId}&phone=${phone}`)
  }

  const activeLeads = getFilteredLeads(activeTab)

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col h-[560px] max-h-[560px] overflow-hidden">
      {/* Sticky Header with Title, View Board & Tab Pills */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2 shrink-0 bg-white dark:bg-gray-950 z-10">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-800" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Leads</h3>
          <button
            onClick={() => router.push('/lead')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:underline flex items-center gap-1 ml-2"
          >
            <span>View Board</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {tabs.map(tab => {
            const count = getFilteredLeads(tab).length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Internal Scrollable Leads Area with Side Scroller */}
      <div className="p-4 flex-1 overflow-y-auto space-y-3.5 pr-2.5 [scrollbar-width:thin] [scrollbar-color:#CBD5E1_transparent] dark:[scrollbar-color:#334155_transparent]">
        {activeLeads.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold">No {activeTab} leads to display</p>
          </div>
        ) : (
          activeLeads.map(lead => {
            const scoreResult = calculateLeadScore({
              stage: lead.stage,
              lead_quality: lead.lead_quality,
              machine_interest: lead.machine_interest,
              callback_ready: lead.callback_ready,
              lead_score: lead.lead_score,
              conversation_summary: lead.conversation_summary,
              messages: lead.last_message ? [{ message: lead.last_message, direction: 'incoming' }] : [],
            })

            return (
              <div
                key={lead.id}
                onClick={() => handleOpenChat(lead)}
                className="border border-gray-100 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all group bg-white dark:bg-gray-900"
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-sm font-bold text-green-700 group-hover:text-indigo-600 transition-colors flex items-center gap-2">
                    <UsersIcon /> {lead.name || `Lead #${lead.phone_number?.slice(-4) || 'Contact'}`}
                  </h4>
                  {lead.phone_number && (
                    <a
                      href={`tel:${lead.phone_number.replace(/\s+/g, '')}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1.5 bg-green-50 dark:bg-green-950/50 hover:bg-green-100 dark:hover:bg-green-900/50 px-2.5 py-1 rounded-lg border border-green-200/80 dark:border-green-800/60 transition-all shadow-2xs group/phone"
                      title={`Call ${lead.phone_number}`}
                    >
                      <Phone className="w-3 h-3 text-green-600 dark:text-green-400 group-hover/phone:scale-110 transition-transform" />
                      <span className="font-mono">{lead.phone_number}</span>
                    </a>
                  )}
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <CalendarIcon /> {new Date(lead.created_at).toLocaleString()}
                </div>

                <div className="flex justify-between items-center mt-3 text-xs font-semibold text-gray-600 dark:text-gray-400">
                  <div>Created By: Admin</div>
                  <div>Stage: <span className="capitalize font-bold text-indigo-600">{lead.stage || 'new'}</span></div>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-50 dark:border-gray-800/60">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold border border-indigo-100 dark:border-indigo-900/40">
                      WhatsApp CRM
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${scoreResult.color}`}>
                      <TrendingUp className="w-2.5 h-2.5" />
                      <span>{scoreResult.score}/100</span>
                      <span className="opacity-80 font-medium">({scoreResult.label})</span>
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open Chat</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
