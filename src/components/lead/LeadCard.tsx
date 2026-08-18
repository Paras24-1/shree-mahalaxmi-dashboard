'use client'

import { Trash2, Tag, ArrowUpRight, UserPlus, RefreshCcw, MessageSquare } from 'lucide-react'

interface LeadCardProps {
  lead: any
  onDelete?: (id: string) => void
}

export default function LeadCard({ lead, onDelete }: LeadCardProps) {
  const formattedDate = lead.created_at
    ? new Date(lead.created_at).toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).replace(',', '')
    : ''

  const sourceColors: Record<string, string> = {
    'Face Book': 'bg-indigo-50 text-indigo-700 border-indigo-100',
    'India Mart': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }

  const sourceClass = lead.source && sourceColors[lead.source]
    ? sourceColors[lead.source]
    : 'bg-indigo-50 text-indigo-700 border-indigo-100'

  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing mb-3"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('leadId', lead.id)
      }}
    >
      <div className="p-3 border-b border-gray-100 dark:border-gray-800">
        <h4 className="text-[13px] font-bold text-gray-800 dark:text-gray-200 mb-2 truncate">
          {lead.name || '<test lead: dummy data>'}
        </h4>
        
        {lead.phone_number && (
          <p className="text-xs text-gray-500 font-semibold mb-2 flex items-center gap-1">
            <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
            {lead.phone_number}
          </p>
        )}

        {lead.source && (
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${sourceClass}`}>
            {lead.source}
          </span>
        )}
      </div>

      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 space-y-1">
        {lead.company_name && (
          <div className="text-[11px] flex items-start gap-2 text-gray-600 dark:text-gray-400">
            <span className="font-semibold w-5 shrink-0">CN:</span>
            <span className="truncate">{lead.company_name}</span>
          </div>
        )}
        
        <div className="text-[11px] flex items-start gap-2 text-gray-600 dark:text-gray-400">
          <span className="font-semibold w-5 shrink-0">CD:</span>
          <span>{formattedDate}</span>
        </div>

        {lead.address && (
          <div className="text-[11px] flex items-start gap-2 text-gray-600 dark:text-gray-400">
            <span className="font-semibold w-5 shrink-0">AD:</span>
            <span className="truncate">{lead.address}</span>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-gray-400">
        <div className="flex items-center gap-2">
          <button onClick={() => onDelete?.(lead.id)} className="hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button className="hover:text-green-500 transition-colors">
            <Tag className="w-3.5 h-3.5" />
          </button>
          <button className="hover:text-blue-500 transition-colors">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button className="hover:text-indigo-500 transition-colors">
            <UserPlus className="w-3.5 h-3.5" />
          </button>
          <button className="hover:text-blue-500 transition-colors">
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>
          <div className="relative cursor-pointer hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            <span className="absolute -top-1.5 -right-1.5 bg-gray-400 text-white text-[8px] font-bold w-3 h-3 flex items-center justify-center rounded-full border border-white">0</span>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <MoreVerticalIcon />
        </button>
      </div>
    </div>
  )
}

function MoreVerticalIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  )
}
