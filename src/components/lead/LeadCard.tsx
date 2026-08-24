'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Tag, ArrowUpRight, UserPlus, RefreshCcw, MessageSquare, ChevronDown, Phone, ArrowRight, Bot, PhoneCall } from 'lucide-react'
import { getLeadColumn } from './LeadBoard'

interface LeadCardProps {
  lead: any
  onDelete?: (id: string) => void
  onStageChange?: (id: string, newStage: string) => void
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New Leads (Last 24h)',
  interested: 'Interested',
  processing: 'In Process (Follow-up)',
  confirm: 'Confirm',
  cancel: 'Cancel (Not Interested)',
}

export default function LeadCard({ lead, onDelete, onStageChange }: LeadCardProps) {
  const router = useRouter()
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [callingAI, setCallingAI] = useState(false)
  const [callDone, setCallDone] = useState(false)

  const handleTriggerAICall = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!lead.phone_number) return
    setCallingAI(true)
    try {
      const res = await fetch('/api/calls/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: lead.phone_number,
          name: lead.name || 'Lead',
          lead_id: lead.id,
          conversation_id: lead.conversation_id,
          notes: lead.followup_notes || 'Triggered from Kanban card',
        }),
      })
      if (res.ok) {
        setCallDone(true)
        setTimeout(() => setCallDone(false), 3000)
      } else {
        alert('Could not initiate Voice AI call')
      }
    } catch {
      alert('Failed to connect to Voice AI server')
    } finally {
      setCallingAI(false)
    }
  }

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

  const handleOpenChat = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const targetId = lead.conversation_id || lead.id || ''
    const phone = lead.phone_number ? encodeURIComponent(lead.phone_number) : ''
    router.push(`/chat?conversation_id=${targetId}&phone=${phone}`)
  }

  return (
    <div
      onClick={handleOpenChat}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-xl shadow-2xs hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-600 transition-all cursor-pointer mb-3 overflow-hidden select-none group"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('leadId', lead.id || lead.conversation_id)
      }}
    >
      {/* Card Header */}
      <div className="p-3.5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
              {lead.name || `Lead #${lead.phone_number?.slice(-4) || 'Contact'}`}
            </h4>
            <ArrowRight className="w-3 h-3 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </div>

          {/* Move Stage Dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowStageMenu((v) => !v)
              }}
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
                    onClick={(e) => {
                      e.stopPropagation()
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
          <a
            href={`tel:${lead.phone_number.replace(/\s+/g, '')}`}
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-mono font-medium mb-2 flex items-center gap-1.5 w-fit hover:underline transition-colors"
            title={`Call ${lead.phone_number}`}
          >
            <Phone className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{lead.phone_number}</span>
          </a>
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

          {currentColumn === 'interested' && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-lime-50 dark:bg-lime-950 text-lime-700 dark:text-lime-300 border border-lime-200 dark:border-lime-800">
              🎯 Interested
            </span>
          )}

          {currentColumn === 'processing' && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              🔄 In Process
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
      <div className="p-3 bg-gray-50/90 dark:bg-gray-800/80 border-y border-gray-100 dark:border-gray-800/80 space-y-1.5 text-[11px]">
        {lead.company_name && (
          <div className="flex items-start gap-1.5 text-gray-700 dark:text-gray-200">
            <span className="font-bold text-gray-400 dark:text-gray-400 w-6 shrink-0">CN:</span>
            <span className="truncate font-medium text-gray-800 dark:text-gray-100">{lead.company_name}</span>
          </div>
        )}

        {formattedDate && (
          <div className="flex items-start gap-1.5 text-gray-700 dark:text-gray-200">
            <span className="font-bold text-gray-400 dark:text-gray-400 w-6 shrink-0">CD:</span>
            <span className="font-medium text-gray-700 dark:text-gray-200">{formattedDate}</span>
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-gray-400">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleOpenChat}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 px-2 py-1 rounded-lg transition-colors"
            title="Open Chat Conversation"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Open Chat</span>
          </button>

          {lead.phone_number && (
            <>
              <a
                href={`https://wa.me/${lead.phone_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 hover:text-emerald-600 transition-colors"
                title="Chat on WhatsApp"
              >
                <Phone className="w-3 h-3 text-emerald-600" />
              </a>

              <button
                onClick={handleTriggerAICall}
                disabled={callingAI}
                className={`p-1 transition-colors ${
                  callDone
                    ? 'text-emerald-600 font-bold'
                    : callingAI
                    ? 'text-violet-500 animate-spin'
                    : 'text-violet-500 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded'
                }`}
                title={callDone ? 'AI Call Initiated' : 'Trigger Voice AI Call'}
              >
                {callingAI ? <RefreshCcw className="w-3 h-3 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
              </button>
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(lead.id || lead.conversation_id)
            }}
            className="p-1 hover:text-red-500 transition-colors"
            title="Delete Lead"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          {STAGE_LABELS[currentColumn]?.split(' ')[0] || 'NEW'}
        </span>
      </div>
    </div>
  )
}
