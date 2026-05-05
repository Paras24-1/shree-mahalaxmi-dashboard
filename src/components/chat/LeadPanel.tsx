'use client'

import { useState, useEffect } from 'react'
import { Conversation, Lead } from '@/types'
import { RefreshCw, User, Phone, Target, FileText } from 'lucide-react'

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
        Select a conversation
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    )
  }

  const data = sheetData || {}

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Lead Information</h3>
        <p className="text-xs text-gray-500 mt-0.5">Synced from Google Sheets</p>
      </div>

      <div className="p-4 space-y-4">
        <Field label="Phone" value={data.Phone} icon={<Phone className="w-3.5 h-3.5" />} />
        <Field label="Name" value={data.Name} icon={<User className="w-3.5 h-3.5" />} />
        <Field label="Customer Name" value={data['Customer name']} />
        <Field label="Lead Type" value={data.Lead_Type} />
        <Field label="Intent" value={data.Intent} icon={<Target className="w-3.5 h-3.5" />} />

        {data.Summary && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Chat Summary</p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {data.Summary}
              </p>
            </div>
          </div>
        )}

        {!data.Phone && !loading && (
          <div className="text-center py-8">
            <p className="text-xs text-gray-400">No lead data found</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
  if (!value) return null
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-gray-400">{icon}</span>}
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-sm text-gray-900 dark:text-white font-medium">{value}</p>
    </div>
  )
}
