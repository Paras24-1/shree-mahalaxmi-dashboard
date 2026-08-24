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
  ChevronUp,
  Check,
  Clock,
  FileText,
  Sparkles,
  Copy,
  Calendar,
  X,
  Plus,
  AlertCircle,
} from 'lucide-react'
import { getLeadColumn } from './LeadBoard'

interface LeadCardProps {
  lead: any
  isSelected?: boolean
  employeeMap?: Map<string, string>
  onToggleSelect?: (id: string) => void
  onDelete?: (id: string) => void
  onStageChange?: (id: string, newStage: string) => void
  onUpdateLead?: (leadId: string, updates: Partial<any>) => void
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
  employeeMap,
  onToggleSelect,
  onDelete,
  onStageChange,
  onUpdateLead,
}: LeadCardProps) {
  const router = useRouter()

  // Dropdowns & Modals state
  const [showStageMenu, setShowStageMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [showSummarySection, setShowSummarySection] = useState(false)

  // Voice AI trigger state
  const [callingAI, setCallingAI] = useState(false)
  const [callSuccess, setCallSuccess] = useState(false)

  // Reminder form state
  const [reminderDate, setReminderDate] = useState(lead.followup_date || '')
  const [reminderNotes, setReminderNotes] = useState(lead.followup_notes || '')
  const [savingReminder, setSavingReminder] = useState(false)

  // Notes form state
  const [leadNoteText, setLeadNoteText] = useState<string>(lead.notes || '')
  const [savingNote, setSavingNote] = useState(false)

  // AI Summary State
  const [summaryData, setSummaryData] = useState<any>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)

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

  // Resolve human-readable assigned name instead of raw UUID
  const assignedDisplay =
    lead.assigned_to_name ||
    (lead.assigned_to && employeeMap?.get(lead.assigned_to)) ||
    (lead.assigned_to && !lead.assigned_to.includes('-') ? lead.assigned_to : 'Shri Mahalaxmi Team')

  const handleOpenChat = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const targetId = lead.conversation_id || lead.id || ''
    const phone = lead.phone_number ? encodeURIComponent(lead.phone_number) : ''
    router.push(`/chat?conversation_id=${targetId}&phone=${phone}`)
  }

  // Voice AI Manual Trigger
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
          notes: lead.followup_notes || lead.notes || 'Triggered from Leads section',
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

  // Save Reminder Handler
  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingReminder(true)
    try {
      const targetId = lead.id || lead.conversation_id
      const updates = {
        followup_date: reminderDate || null,
        followup_notes: reminderNotes || null,
        followup_notified: false,
        stage: reminderDate ? 'processing' : lead.stage,
      }

      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          conversation_id: lead.conversation_id,
          ...updates,
        }),
      })

      onUpdateLead?.(targetId, updates)
      setShowReminderModal(false)
    } catch (err) {
      console.error('Failed to save reminder:', err)
      alert('Failed to save reminder')
    } finally {
      setSavingReminder(false)
    }
  }

  // Quick Preset Helper for Reminder
  const setPresetDate = (hoursFromNow: number, setTimeHour?: number) => {
    const d = new Date()
    if (setTimeHour !== undefined) {
      d.setDate(d.getDate() + Math.floor(hoursFromNow / 24))
      d.setHours(setTimeHour, 0, 0, 0)
    } else {
      d.setTime(d.getTime() + hoursFromNow * 60 * 60 * 1000)
    }

    const pad = (n: number) => String(n).padStart(2, '0')
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    setReminderDate(formatted)
  }

  // Save Note Handler
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingNote(true)
    try {
      const targetId = lead.id || lead.conversation_id
      const updates = { notes: leadNoteText.trim() }

      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          conversation_id: lead.conversation_id,
          ...updates,
        }),
      })

      // Also record in lead_activities for audit trail
      if (lead.id && leadNoteText.trim()) {
        await fetch('/api/lead-activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            activity_type: 'note',
            description: leadNoteText.trim(),
          }),
        }).catch(() => {})
      }

      onUpdateLead?.(targetId, updates)
      setShowNotesModal(false)
    } catch (err) {
      console.error('Failed to save note:', err)
      alert('Failed to save note')
    } finally {
      setSavingNote(false)
    }
  }

  // Fetch / Generate AI Chat Summary
  const handleToggleSummary = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (showSummarySection) {
      setShowSummarySection(false)
      return
    }

    setShowSummarySection(true)
    if (!summaryData) {
      setLoadingSummary(true)
      try {
        const convId = lead.conversation_id || lead.id || ''
        const phone = lead.phone_number || ''
        const res = await fetch(
          `/api/summary?conversation_id=${encodeURIComponent(convId)}&phone=${encodeURIComponent(phone)}`
        )
        const data = await res.json()
        if (data.success && data.summary) {
          setSummaryData(data.summary)
        }
      } catch (err) {
        console.error('Failed to fetch summary:', err)
      } finally {
        setLoadingSummary(false)
      }
    }
  }

  const handleCopySummary = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!summaryData) return
    const text = `📋 Lead Summary (${leadName}):\n• Intent: ${summaryData.intent}\n• Overview: ${summaryData.overview}\n• Key Points: ${(summaryData.keyPoints || []).join(', ')}\n• Next Action: ${summaryData.nextAction}`
    navigator.clipboard.writeText(text)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2500)
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
            {lead.source || 'WhatsApp Direct'}
          </span>

          {/* Quick Tag Switcher Pills */}
          <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">TAG:</span>
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

        {/* Active Reminder Pill (If set) */}
        {lead.followup_date && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              setShowReminderModal(true)
            }}
            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-purple-800 dark:text-purple-300 text-xs font-semibold mb-2.5 hover:bg-purple-100 transition-colors"
            title="Click to edit reminder"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span className="truncate">
                ⏰ Reminder:{' '}
                {new Date(lead.followup_date).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {lead.followup_notes ? ` • "${lead.followup_notes}"` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-200 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200">
                Voice AI Auto-Call
              </span>
            </div>
          </div>
        )}

        {/* Active Note Preview Pill (If set) */}
        {lead.notes && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              setShowNotesModal(true)
            }}
            className="flex items-start gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 text-xs mb-2.5 hover:bg-amber-100/80 transition-colors"
            title="Click to edit note"
          >
            <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="line-clamp-2 text-xs font-medium text-gray-800 dark:text-gray-200">
              <span className="font-bold text-amber-800 dark:text-amber-300">Note: </span>
              {lead.notes}
            </p>
          </div>
        )}

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
            <span className="text-gray-900 dark:text-gray-100 font-semibold truncate text-indigo-900 dark:text-indigo-300">
              {assignedDisplay}
            </span>
          </div>

          <div className="grid grid-cols-[110px_12px_1fr] items-center">
            <span className="text-gray-500 dark:text-gray-400">Reference</span>
            <span className="text-gray-400">:</span>
            <span className="text-gray-900 dark:text-gray-100 truncate">
              {lead.reference || lead.source || 'WhatsApp Direct'}
            </span>
          </div>

          <div className="grid grid-cols-[110px_12px_1fr] items-center">
            <span className="text-gray-500 dark:text-gray-400">Lead Source</span>
            <span className="text-gray-400">:</span>
            <span className="text-gray-900 dark:text-gray-100 truncate capitalize">
              {lead.source || 'WhatsApp Direct'}
            </span>
          </div>
        </div>

        {/* Expandable AI Chat Summary Section */}
        {showSummarySection && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-2.5 p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-pink-50/30 dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-pink-950/10 border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs animate-in fade-in zoom-in-95 duration-150 text-xs"
          >
            <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-800/60 pb-2 mb-2.5">
              <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-200">
                <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                <span>AI Chat Summary</span>
              </div>

              <div className="flex items-center gap-1">
                {summaryData && (
                  <button
                    onClick={handleCopySummary}
                    className="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-[10px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 flex items-center gap-1 transition-colors"
                    title="Copy Summary"
                  >
                    {copiedSummary ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
                <button
                  onClick={() => setShowSummarySection(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {loadingSummary ? (
              <div className="py-4 text-center text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
                <span className="font-semibold text-xs">Generating AI Summary from messages...</span>
              </div>
            ) : summaryData ? (
              <div className="space-y-2 text-gray-800 dark:text-gray-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 block mb-0.5">
                    🎯 Customer Intent
                  </span>
                  <p className="font-semibold text-xs text-gray-900 dark:text-white">{summaryData.intent}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 block mb-0.5">
                    📋 Discussion Overview
                  </span>
                  <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">{summaryData.overview}</p>
                </div>

                {summaryData.keyPoints && summaryData.keyPoints.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 block mb-0.5">
                      🔑 Key Points
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                      {summaryData.keyPoints.map((pt: string, idx: number) => (
                        <li key={idx}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summaryData.nextAction && (
                  <div className="pt-1.5 border-t border-indigo-100 dark:border-indigo-800/40">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-purple-600 dark:text-purple-400 block mb-0.5">
                      🚀 Recommended Next Action
                    </span>
                    <p className="text-xs font-semibold text-purple-900 dark:text-purple-200">
                      {summaryData.nextAction}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-2">No messages recorded to generate summary.</p>
            )}
          </div>
        )}

        {/* Card Bottom Action Row */}
        <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Timeline */}
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

            {/* Set Reminder Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowReminderModal(true)
              }}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                lead.followup_date
                  ? 'text-purple-700 bg-purple-100 dark:bg-purple-950'
                  : 'text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/50'
              }`}
              title={lead.followup_date ? 'Edit Scheduled Reminder' : 'Set Follow-up Reminder'}
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Note Taking Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowNotesModal(true)
              }}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                lead.notes
                  ? 'text-amber-700 bg-amber-100 dark:bg-amber-950'
                  : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/50'
              }`}
              title={lead.notes ? 'View / Edit Note' : 'Add Note'}
            >
              <FileText className="w-4 h-4" />
            </button>

            {/* AI Summary Button */}
            <button
              type="button"
              onClick={handleToggleSummary}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                showSummarySection
                  ? 'text-indigo-700 bg-indigo-100 dark:bg-indigo-950'
                  : 'text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/50'
              }`}
              title="View AI Chat Summary"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
            </button>

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
              <div className="absolute right-0 bottom-8 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1.5 z-40 text-xs text-gray-800 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={handleOpenChat}
                  className="w-full text-left px-3 py-1.5 font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  View Details
                </button>
                <button
                  onClick={() => {
                    setShowMoreMenu(false)
                    setShowReminderModal(true)
                  }}
                  className="w-full text-left px-3 py-1.5 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-purple-600"
                >
                  Set Reminder
                </button>
                <button
                  onClick={() => {
                    setShowMoreMenu(false)
                    setShowNotesModal(true)
                  }}
                  className="w-full text-left px-3 py-1.5 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 text-amber-600"
                >
                  Add / Edit Note
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

      {/* ⏰ Set Follow-up Reminder Modal */}
      {showReminderModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white text-sm">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>Set Follow-up Reminder: {leadName}</span>
              </div>
              <button
                onClick={() => setShowReminderModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReminder} className="space-y-3.5 text-xs">
              {/* Quick Presets */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                  Quick Presets
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPresetDate(24, 10)}
                    className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 text-left"
                  >
                    ☀️ Tomorrow 10:00 AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDate(24, 16)}
                    className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 text-left"
                  >
                    🌇 Tomorrow 04:00 PM
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDate(48, 11)}
                    className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 text-left"
                  >
                    📅 In 2 Days (11:00 AM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetDate(168, 11)}
                    className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800/40 hover:bg-purple-100 text-left"
                  >
                    🗓️ Next Week (11:00 AM)
                  </button>
                </div>
              </div>

              {/* Custom Date & Time Picker */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                  Custom Reminder Date & Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Notes / Callback Purpose */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                  Reminder Notes / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Discuss agarbatti machine quotation & delivery date"
                  value={reminderNotes}
                  onChange={(e) => setReminderNotes(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Voice AI Auto-Dial Info */}
              <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 flex items-center gap-2 text-purple-900 dark:text-purple-200">
                <Bot className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="text-[11px] leading-tight">
                  Voice AI will automatically call <strong>{lead.phone_number || leadName}</strong> at this exact time!
                </span>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                {lead.followup_date && (
                  <button
                    type="button"
                    onClick={() => {
                      setReminderDate('')
                      setReminderNotes('')
                      handleSaveReminder({ preventDefault: () => {} } as any)
                    }}
                    className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 rounded-xl font-semibold"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowReminderModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingReminder}
                  className="flex-1 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {savingReminder ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Reminder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📝 Notes Taking Drawer / Modal */}
      {showNotesModal && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white text-sm">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Lead Notes: {leadName}</span>
              </div>
              <button
                onClick={() => setShowNotesModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-3.5 text-xs">
              {/* Quick Note Snippets */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1.5">
                  Quick Note Templates
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Interested in Automatic Agarbatti Machine',
                    'Quotation sent on WhatsApp',
                    'Requested callback tomorrow',
                    'Price negotiation in progress',
                    'High potential lead / Hot customer',
                  ].map((tpl) => (
                    <button
                      key={tpl}
                      type="button"
                      onClick={() =>
                        setLeadNoteText((prev: string) => (prev ? `${prev}\n• ${tpl}` : `• ${tpl}`))
                      }
                      className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 text-[11px] font-semibold hover:bg-amber-100"
                    >
                      + {tpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea for note */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                  Note Content
                </label>
                <textarea
                  rows={4}
                  placeholder="Write detailed notes regarding discussions, requirements, or customer preferences..."
                  value={leadNoteText}
                  onChange={(e) => setLeadNoteText(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-950 text-xs outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed font-sans"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowNotesModal(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNote}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                >
                  {savingNote ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Save Note</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(LeadCardComponent)
