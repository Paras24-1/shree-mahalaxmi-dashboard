'use client'

import React, { useState, useEffect } from 'react'
import { Conversation, Lead } from '@/types'
import { RefreshCw, Phone, User, Target, MapPin, Wrench, Star, CheckCircle, MessageSquare, TrendingUp } from 'lucide-react'

export default function LeadPanel({ conversation, lead, onLeadUpdate }: {
  conversation: Conversation | null
  lead: Lead | null
  onLeadUpdate: (updates: Partial<Lead>) => void
}) {
  const [loading, setLoading] = useState(false)
  const [sheetData, setSheetData] = useState<any>(null)

  useEffect(() => {
    if (!conversation) return
    setLoading(true)
    fetch(`/api/sheets?phone=${conversation.phone_number}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && !data.error) {
          setSheetData(data)
          onLeadUpdate(data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conversation?.phone_number])

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-gray-400 text-sm">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>Select a conversation</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    )
  }

  const data = sheetData || {}

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Lead Details</h3>
        </div>
        <p className="text-xs text-gray-500 ml-10">Live sync from Google Sheets</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {data.Phone ? (
          <>
            <InfoCard icon={Phone} label="Phone Number" value={data.Phone} />
            <InfoCard icon={User} label="Name" value={data.Name} />
            <InfoCard icon={Target} label="Lead Type" value={data.Lead_Type} badge />
            <InfoCard icon={MapPin} label="City" value={data.city} />
            <InfoCard icon={Wrench} label="Machine Interest" value={data.machine_interest} />
            <InfoCard icon={Star} label="Lead Quality" value={data.lead_quality} badge colored />
            <InfoCard icon={TrendingUp} label="Lead Score" value={data.lead_score} badge colored />
            <InfoCard icon={CheckCircle} label="Callback Ready" value={data.callback_ready} badge />

            {data.conversation_summary && (
              <div className="mt-5 p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">Conversation Summary</p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                  {data.conversation_summary}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <User className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">No lead data found</p>
            <p className="text-xs text-gray-500">Data will appear once synced from Google Sheets</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value, badge, colored }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string
  badge?: boolean
  colored?: boolean
}) {
  if (!value) return null

  return (
    <div className="p-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-emerald-200 dark:hover:border-emerald-900 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400">
          <Icon className="w-3 h-3" />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</p>
      </div>
      
      {badge ? (
        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
          colored
            ? value.toLowerCase() === 'high' || parseInt(value) >= 80
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
              : value.toLowerCase() === 'medium' || (parseInt(value) >= 50 && parseInt(value) < 80)
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
              : value.toLowerCase() === 'low' || parseInt(value) < 50
              ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
            : value.toLowerCase() === 'yes'
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {value}
        </span>
      ) : (
        <p className="text-sm text-gray-900 dark:text-white font-medium break-words">{value}</p>
      )}
    </div>
  )
}
