'use client'

import React, { useState } from 'react'
import { Trash2, Tag, ArrowUpRight, UserPlus, RefreshCcw, MessageSquare, ChevronDown, Phone } from 'lucide-react'
import { getLeadColumn } from './LeadBoard'

interface LeadCardProps {
  lead: any
  onDelete?: (id: string) => void
  onStageChange?: (id: string, newStage: string) => void
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New Leads (Last 24h)',
  processing: 'In Process (Interested)',
  close_by: 'Close-by',
  confirm: 'Confirm',
  cancel: 'Cancel (Not Interested)',
}

export default function LeadCard({ lead, onDelete, onStageChange }: LeadCardProps) {
  const [showStageMenu, setShowStageMenu] = useState(false)

  const formattedDate = lead.created_at
    ? new Date(lead.created_at)
        .toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        .replace(',', '')
    : ''

  const currentColumn = getLeadColumn(lead.stage, lead.created_at)

  const createdTime = lead.created_at ? new Date(lead.created_at).getTime() : 0
  const ageHours = createdTime ? (Date.now() - createdTime) / (1000 * 60 * 60) : 999
  const isLast24h = ageHours <= 24

  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing mb-3 overflow-hidden select-none"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('leadId', lead.id || lead.conversation_id)
      }}
    >
      {/* Card Header */}
      <div className="p-3.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate flex-1">
            {lead.name || `Lead #${lead.phone_number?.slice(-4) || 'Contact'}`}
          </h4>

          {/* Move Stage Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStageMenu((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
              title="Change Stage"
            >
              <span>{STAGE_LABELS[currentColumn]?.split(' ')[0] || 'Stage'}</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {showStageMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 z-30 text-xs">
                {Object.entries(STAGE_LABELS).map(([stageKey, label]) => (
                  <button
                    key={stageKey}
                    onClick={() => {
                      onStageChange?.(lead.id || lead.conversation_id, stageKey)
                      setShowStageMenu(false)
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between ${
                      currentColumn === stageKey ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span>{label}</span>
                    {currentColumn === stageKey && <span className="text-indigo-600">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {lead.phone_number && (
          <p className="text-[11px] text-gray-500 font-mono font-medium mb-2 flex items-center gap-1">
            <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>{lead.phone_number}</span>
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold border bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/40">
            {lead.source || 'Face Book'}
          </span>

          {currentColumn === 'new' && isLast24h && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              ⚡ &lt;24h New
            </span>
          )}

          {currentColumn === 'processing' && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {lead.stage === 'interested' ? '🎯 Interested' : '🔄 In Process'}
            </span>
          )}

          {currentColumn === 'cancel' && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              ❌ Cancelled
            </span>
          )}
        </div>
      </div>

      {/* Card Details */}
      <div className="p-3 bg-gray-50/60 dark:bg-gray-850/40 space-y-1 text-[11px]">
        {lead.company_name && (
          <div className="flex items-start gap-1.5 text-gray-600 dark:text-gray-400">
            <span className="font-bold text-gray-400 w-5 shrink-0">CN:</span>
            <span className="truncate font-medium">{lead.company_name}</span>
          </div>
        )}

        {formattedDate && (
          <div className="flex items-start gap-1.5 text-gray-500 dark:text-gray-400">
            <span className="font-bold text-gray-400 w-5 shrink-0">CD:</span>
            <span>{formattedDate}</span>
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-gray-400">
        <div className="flex items-center gap-2">
          {lead.phone_number && (
            <a
              href={`https://wa.me/${lead.phone_number.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:text-emerald-600 transition-colors"
              title="Chat on WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={() => onDelete?.(lead.id || lead.conversation_id)}
            className="p-1 hover:text-red-500 transition-colors"
            title="Delete Lead"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          {STAGE_LABELS[currentColumn] || 'NEW'}
        </span>
      </div>
    </div>
  )
}
