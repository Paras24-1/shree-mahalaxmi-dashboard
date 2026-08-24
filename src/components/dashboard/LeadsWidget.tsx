'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Filter, Phone, MessageSquare, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function LeadsWidget() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('New')
  const [leads, setLeads] = useState<any[]>([])

  useEffect(() => {
    async function loadLeads() {
      // In a real app, 'Processing' and 'Close-by' would map to specific stages.
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(10)
      if (data) setLeads(data)
    }
    loadLeads()
  }, [])

  const tabs = ['Today', 'New', 'Interested', 'Processing']

  const getFilteredLeads = (tab: string) => {
    if (tab === 'Today') {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime()
      return leads.filter(l => {
        if (!l.created_at) return false
        return new Date(l.created_at).getTime() >= startOfToday
      })
    }
    if (tab === 'New') {
      return leads.filter(l => l.stage === 'new' || !l.stage)
    }
    if (tab === 'Interested') {
      return leads.filter(l => ['interested', 'hot_customer', 'hot_lead', 'booking', 'proposal_sent', 'booked', 'deal_done'].includes(l.stage?.toLowerCase()))
    }
    if (tab === 'Processing') {
      return leads.filter(l => ['processing', 'in_process', 'in_discussion', 'callback_done_by_ai', 'call_done', 'followup', 'not_connected'].includes(l.stage?.toLowerCase()))
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
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col min-h-[400px]">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
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

      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {activeLeads.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Filter className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-semibold">No {activeTab} leads to display</p>
          </div>
        ) : (
          activeLeads.map(lead => (
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
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-green-600" /> {lead.phone_number}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <CalendarIcon /> {new Date(lead.created_at).toLocaleString()}
              </div>

              <div className="flex justify-between items-center mt-3 text-xs font-semibold text-gray-600 dark:text-gray-400">
                <div>Created By: Admin</div>
                <div>Stage: <span className="capitalize font-bold text-indigo-600">{lead.stage || 'new'}</span></div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold border border-indigo-100 dark:border-indigo-900/40">
                    WhatsApp CRM
                  </span>
                </div>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Chat</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))
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
