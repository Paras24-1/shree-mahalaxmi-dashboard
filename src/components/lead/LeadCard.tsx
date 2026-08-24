'use client'

import React, { useState, memo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Phone,
  MessageCircle,
  TrendingUp,
  RefreshCw,
  Trash2,
  Send,
  MoreVertical,
  Bot,
  ChevronDown,
  Check,
} from 'lucide-react'
import { getLeadColumn } from './LeadBoard'

interface LeadCardProps {
  lead: any
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  onDelete?: (id: string) => void
  onStageChange?: (id: string, newStage: string) => void
}

const STAGE_CONFIG: Record<
  string,
  { label: string; bg: string; activeBg: string; border: string; text: string }
> = {
  new: {
    label: 'New',
    bg: 'bg-[#005f73]',
    activeBg: 'bg-[#005f73]',
    border: 'border-[#005f73]',
    text: 'text-white',
  },
  processing: {
    label: 'Processing',
    bg: 'bg-[#1d3557]',
    activeBg: 'bg-[#1d3557]',
    border: 'border-[#1d3557]',
    text: 'text-white',
  },
  interested: {
    label: 'Interested',
    bg: 'bg-[#2b9348]',
    activeBg: 'bg-[#2b9348]',
    border: 'border-[#2b9348]',
    text: 'text-white',
  },
  confirm: {
    label: 'Confirm',
    bg: 'bg-[#007f5f]',
    activeBg: 'bg-[#007f5f]',
    border: 'border-[#007f5f]',
    text: 'text-white',
  },
  cancel: {
    label: 'Cancel',
    bg: 'bg-[#d90429]',
    activeBg: 'bg-[#d90429]',
    border: 'border-[#d90429]',
    text: 'text-white',
  },
}

const STAGE_OPTIONS = [
  { id: 'new', label: 'New', activeBg: 'bg-[#005f73]' },
  { id: 'processing', label: 'Processing', activeBg: 'bg-[#1d3557]' },
  { id: 'interested', label: 'Interested', activeBg: 'bg-[#2b9348]' },
  { id: 'confirm', label: 'Confirm', activeBg: 'bg-[#007f5f]' },
  { id: 'cancel', label: 'Cancel', activeBg: 'bg-[#d90429]' },
]

function LeadCardComponent({
  lead,
  isSelected = false,
  onToggleSelect,
  onDelete,
  onStageChange,
}: LeadCardProps) {
  const router = useRouter()
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [callingAI, setCallingAI] = useState(false)
  const [callSuccess, setCallSuccess] = useState(false)

  const currentColumn = getLeadColumn(lead.stage, lead.created_at)
  const stageBadge = STAGE_CONFIG[currentColumn] || STAGE_CONFIG['new']

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
    : '24-08-2026 17:15'

  const leadName = lead.name || (lead.phone_number ? `Lead ${lead.phone_number.slice(-4)}` : 'Customer')
  const initial = leadName.trim().charAt(0).toUpperCase() || 'D'
  const rawPhone = (lead.phone_number || '').replace(/\D/g, '')
  const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone

  const handleOpenChat = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const targetId = lead.conversation_id || lead.id || ''
    const phone = lead.phone_number ? encodeURIComponent(lead.phone_number) : ''
    router.push(`/chat?conversation_id=${targetId}&phone=${phone}`)
  }

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
          name: leadName,
          lead_id: lead.id,
          conversation_id: lead.conversation_id,
          notes: lead.followup_notes || 'Triggered from Leads section',
        }),
      })
      if (res.ok) {
        setCallSuccess(true)
        setTimeout(() => setCallSuccess(false), 3000)
      } else {
        alert('Could not initiate Voice AI call')
      }
    } catch {
      alert('Failed to connect to Voice AI server')
    } finally {
      setCallingAI(false)
    }
  }

  return (
    <div
      onClick={handleOpenChat}
      className={`
        relative bg-white dark:bg-gray-900 border rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer mb-3.5 overflow-hidden select-none group
        ${isSelected ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-gray-200 dark:border-gray-800'}
        before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1.5 before:bg-[#253B80] dark:before:bg-indigo-500 before:rounded-r-md
      `}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('leadId', lead.id || lead.conversation_id)
      }}
    >
      {/* Interactive Top-Right Stage Tag Dropdown */}
      <div className="absolute top-0 right-0 z-10" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setShowStageMenu((v) => !v)}
          className={`
            inline-flex items-center gap-1 text-[11px] font-bold px-3 py-0.5 rounded-bl-xl rounded-tr-2xl tracking-wide uppercase shadow-2xs hover:brightness-110 transition-all cursor-pointer
            ${stageBadge.bg} ${stageBadge.text}
          `}
          title="Click to Switch Stage / Tag"
        >
          <span>{stageBadge.label}</span>
          <ChevronDown className="w-3 h-3 opacity-80" />
        </button>

        {showStageMenu && (
          <div className="absolute right-0 top-7 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl py-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
              Switch Stage Tag
            </div>
            {STAGE_OPTIONS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  onStageChange?.(lead.id || lead.conversation_id, st.id)
                  setShowStageMenu(false)
                }}
                className={`w-full text-left px-3 py-2 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between transition-colors ${
                  currentColumn === st.id ? 'text-indigo-600 bg-indigo-50/50 font-bold' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <span>{st.label}</span>
                {currentColumn === st.id && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Card Content */}
      <div className="p-4 pl-5">
        {/* Top Header Row: Avatar, Name, Phone & Select Circle */}
        <div className="flex items-start justify-between gap-3 mb-2 pr-20">
          <div className="flex items-start gap-3">
            {/* Avatar Circle */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-700 to-indigo-900 flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0 mt-0.5">
              {initial}
            </div>

            {/* Name & Phone Info */}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                {leadName}
              </h3>

              {lead.phone_number && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 font-mono">
                    {lead.phone_number}
                  </span>

                  {/* Instant Call Icon */}
                  <a
                    href={`tel:${lead.phone_number.replace(/\s+/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/50 rounded transition-colors"
                    title="Direct Phone Call"
                  >
                    <Phone className="w-3.5 h-3.5 fill-current" />
                  </a>

                  {/* Instant WhatsApp Icon */}
                  <a
                    href={`https://wa.me/${cleanPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded transition-colors"
                    title="WhatsApp Chat"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-emerald-100 dark:fill-emerald-950" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Selection Circle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect?.(lead.id || lead.conversation_id)
            }}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
              isSelected
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500'
            }`}
            title="Select Lead"
          >
            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
          </button>
        </div>

        {/* Source Badge & 1-Tap Quick Tag Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[#ECEEFE] dark:bg-indigo-950/60 text-[#3D47B4] dark:text-indigo-300 border border-[#DCE2FE] dark:border-indigo-900/40">
            {lead.source || 'India Mart'}
          </span>

          {/* Quick Tag Switcher Pills */}
          <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Tag:</span>
            {STAGE_OPTIONS.map((st) => {
              const isActive = currentColumn === st.id
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => onStageChange?.(lead.id || lead.conversation_id, st.id)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                    isActive
                      ? `${st.activeBg} text-white shadow-2xs`
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={`Switch to ${st.label}`}
                >
                  {st.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Key-Value Details Grid */}
        <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300 font-medium pb-2 border-t border-gray-100 dark:border-gray-800/80 pt-2">
          <div className="grid grid-cols-[110px_12px_1fr] items-center">
            <span className="text-gray-500 dark:text-gray-400">Company Name</span>
            <span className="text-gray-400">:</span>
            <span className="text-gray-900 dark:text-gray-100 truncate">
              {lead.company_name || '-'}
            </span>
          </div>

          <div className="grid grid-cols-[110px_12px_1fr] items-center">
            <span className="text-gray-500 dark:text-gray-400">Created Date</span>
            <span className="text-gray-400">:</span>
            <span className="text-gray-900 dark:text-gray-100 font-mono">
              {formattedDate}
            </span>
          </div>

          <div className="grid grid-cols-[110px_12px_1fr] items-center">
            <span className="text-gray-500 dark:text-gray-400">Created By</span>
            <span className="text-gray-400">:</span>
            <span className="text-gray-900 dark:text-gray-100 truncate">
              Shri Mahalaxmi Enterprises
            </span>
          </div>

          <div className="grid grid-cols-[110px_12px_1fr] items-center">
            <span className="text-gray-500 dark:text-gray-400">Assign To</span>
            <span className="text-gray-400">:</span>
            <span className="text-gray-900 dark:text-gray-100 truncate">
              {lead.assigned_to_name || lead.assigned_to || 'Priyanka Kamble'}
            </span>
          </div>

          <div className="grid grid-cols-[110px_12px_1fr] items-center">
            <span className="text-gray-500 dark:text-gray-400">Reference</span>
            <span className="text-gray-400">:</span>
            <span className="text-gray-900 dark:text-gray-100 truncate">
              {lead.reference || lead.source || 'India Mart'}
            </span>
          </div>

          <div className="grid grid-cols-[110px_12px_1fr] items-center">
            <span className="text-gray-500 dark:text-gray-400">Lead Source</span>
            <span className="text-gray-400">:</span>
            <span className="text-gray-900 dark:text-gray-100 truncate capitalize">
              {lead.source || 'Indiamart'}
            </span>
          </div>
        </div>

        {/* Card Bottom Action Row */}
        <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Timeline / Analytics */}
            <button
              type="button"
              onClick={handleOpenChat}
              className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-lg transition-colors"
              title="View Activity Timeline"
            >
              <TrendingUp className="w-4 h-4" />
            </button>

            {/* Change Stage Icon */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowStageMenu((v) => !v)}
                className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/50 rounded-lg transition-colors"
                title="Change Stage"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Delete Lead */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(lead.id || lead.conversation_id)
              }}
              className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
              title="Delete Lead"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Send Message / Chat with Badge */}
            <button
              type="button"
              onClick={handleOpenChat}
              className="relative p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
              title="Open Chat"
            >
              <Send className="w-4 h-4" />
              <span className="absolute -top-1 -right-1.5 text-[9px] font-bold text-gray-400">0</span>
            </button>

            {/* Voice AI Call Trigger */}
            <button
              type="button"
              onClick={handleTriggerAICall}
              disabled={callingAI}
              className={`p-1.5 rounded-lg transition-colors ${
                callSuccess
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950'
                  : callingAI
                  ? 'text-violet-600 animate-spin'
                  : 'text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/50'
              }`}
              title={callSuccess ? 'AI Call Initiated!' : 'Trigger Voice AI Call'}
            >
              <Bot className="w-4 h-4" />
            </button>
          </div>

          {/* Three dots menu */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowMoreMenu((v) => !v)}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 bottom-8 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1.5 z-40 text-xs text-gray-800 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={handleOpenChat}
                  className="w-full text-left px-3 py-1.5 font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  View Details
                </button>
                <button
                  onClick={handleTriggerAICall}
                  className="w-full text-left px-3 py-1.5 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-violet-600 dark:text-violet-400"
                >
                  Voice AI Call
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMoreMenu(false)
                    onDelete?.(lead.id || lead.conversation_id)
                  }}
                  className="w-full text-left px-3 py-1.5 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600"
                >
                  Delete Lead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(LeadCardComponent)
