'use client'

import React, { useState, useEffect } from 'react'
import { Conversation, Lead, LeadActivity } from '@/types'
import { RefreshCw, Phone, User, Target, MapPin, Wrench, Star, CheckCircle, MessageSquare, TrendingUp, StickyNote, Save, Calendar, Clock, Trash2, X, Plus, Check, Edit2 } from 'lucide-react'

export default function LeadPanel({ conversation, lead, onLeadUpdate }: {
  conversation: Conversation | null
  lead: Lead | null
  onLeadUpdate: (updates: Partial<Lead>) => void
}) {
  const [loading, setLoading] = useState(false)
  const [sheetData, setSheetData] = useState<any>(null)
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [modalDate, setModalDate] = useState<Date | null>(null)
  const [modalNotes, setModalNotes] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [customDateVal, setCustomDateVal] = useState('')
  const [customTimeVal, setCustomTimeVal] = useState('')
  const [savingFollowup, setSavingFollowup] = useState(false)
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [showAddActivityModal, setShowAddActivityModal] = useState(false)
  const [showMarkDoneModal, setShowMarkDoneModal] = useState(false)
  const [activityType, setActivityType] = useState('followup_call')
  const [activityDesc, setActivityDesc] = useState('Followup via Call')
  const [activityNotes, setActivityNotes] = useState('')
  const [savingActivity, setSavingActivity] = useState(false)
  const [editingActivity, setEditingActivity] = useState<LeadActivity | null>(null)

  const fetchActivities = async (leadId: string) => {
    setLoadingActivities(true)
    try {
      const res = await fetch(`/api/lead-activities?lead_id=${leadId}`)
      if (res.ok) {
        const data = await res.json()
        setActivities(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Failed to load activities:', err)
    } finally {
      setLoadingActivities(false)
    }
  }

  useEffect(() => {
    if (lead?.id) {
      fetchActivities(lead.id)
    } else {
      setActivities([])
    }
  }, [lead?.id])

  const handleAddManualActivity = async () => {
    if (!lead?.id || !activityDesc.trim()) return
    setSavingActivity(true)
    try {
      const res = await fetch('/api/lead-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          activity_type: activityType,
          description: activityDesc.trim(),
          notes: activityNotes.trim()
        })
      })
      if (res.ok) {
        await fetchActivities(lead.id)
        setShowAddActivityModal(false)
        setActivityNotes('')
      }
    } catch (err) {
      console.error('Failed to save activity:', err)
    } finally {
      setSavingActivity(false)
    }
  }

  const handleUpdateActivity = async () => {
    if (!editingActivity || !activityDesc.trim() || !lead?.id) return
    setSavingActivity(true)
    try {
      const res = await fetch('/api/lead-activities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingActivity.id,
          description: activityDesc.trim(),
          notes: activityNotes.trim()
        })
      })
      if (res.ok) {
        await fetchActivities(lead.id)
        setShowAddActivityModal(false)
        setEditingActivity(null)
        setActivityNotes('')
        setActivityDesc('')
      }
    } catch (err) {
      console.error('Failed to update activity:', err)
    } finally {
      setSavingActivity(false)
    }
  }

  const handleDeleteActivity = async (id: string) => {
    if (!lead?.id) return
    if (!window.confirm('Are you sure you want to delete this activity?')) return
    try {
      const res = await fetch(`/api/lead-activities?id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        await fetchActivities(lead.id)
      }
    } catch (err) {
      console.error('Failed to delete activity:', err)
    }
  }

  const closeActivityModal = () => {
    setShowAddActivityModal(false)
    setEditingActivity(null)
    setActivityNotes('')
    setActivityDesc('')
  }

  const handleMarkFollowupDone = async () => {
    if (!conversation || !lead?.id) return
    setSavingActivity(true)
    try {
      await fetch('/api/lead-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          activity_type: activityType,
          description: activityDesc.trim(),
          notes: activityNotes.trim() || lead.followup_notes
        })
      })

      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          followup_date: null,
          followup_notes: null,
          followup_notified: false
        })
      })

      onLeadUpdate({
        followup_date: undefined,
        followup_notes: undefined,
        followup_notified: false
      })
      await fetchActivities(lead.id)
      setShowMarkDoneModal(false)
      setActivityNotes('')
    } catch (err) {
      console.error('Failed to complete follow-up:', err)
    } finally {
      setSavingActivity(false)
    }
  }

  const formatActivityDate = (dateStr: string) => {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const datePart = d.toLocaleDateString('en-GB').replace(/\//g, '-') // DD-MM-YYYY
    const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    return `${datePart} at ${timePart}`
  }

  // Load existing values when modal opens
  useEffect(() => {
    if (showFollowupModal) {
      if (lead?.followup_date) {
        const existing = new Date(lead.followup_date);
        setModalDate(existing);
        setModalNotes(lead.followup_notes || '');
        setCustomMode(true);
        setCustomDateVal(existing.toISOString().split('T')[0]);
        setCustomTimeVal(existing.toTimeString().split(' ')[0].slice(0, 5));
      } else {
        const now = new Date();
        const defaultDate = new Date(now);
        defaultDate.setHours(now.getHours() + 2, 0, 0, 0);
        setModalDate(defaultDate);
        setModalNotes('');
        setCustomMode(false);
        setCustomDateVal(defaultDate.toISOString().split('T')[0]);
        setCustomTimeVal(defaultDate.toTimeString().split(' ')[0].slice(0, 5));
      }
    }
  }, [showFollowupModal, lead])

  // Helper to update custom date time
  const updateCustomDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return;
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, min] = timeStr.split(':').map(Number);
    const d = new Date(year, month - 1, day, hour, min, 0, 0);
    setModalDate(d);
  };

  const handleSaveFollowup = async () => {
    if (!conversation || !modalDate) return;
    setSavingFollowup(true);
    try {
      const isoString = modalDate.toISOString();
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          followup_date: isoString,
          followup_notes: modalNotes,
          followup_notified: false
        })
      });
      onLeadUpdate({
        followup_date: isoString,
        followup_notes: modalNotes,
        followup_notified: false
      });
      setShowFollowupModal(false);
    } catch (err) {
      console.error('Failed to save follow-up:', err);
    } finally {
      setSavingFollowup(false);
    }
  };

  const handleClearFollowup = async () => {
    if (!conversation || !lead) return;
    try {
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          followup_date: null,
          followup_notes: null,
          followup_notified: false
        })
      });
      onLeadUpdate({
        followup_date: undefined,
        followup_notes: undefined,
        followup_notified: false
      });
    } catch (err) {
      console.error('Failed to clear follow-up:', err);
    }
  };

  const getPresets = () => {
    const now = new Date();
    
    const todayPlus2 = new Date(now);
    todayPlus2.setHours(now.getHours() + 2, 0, 0, 0);
    
    const todayPlus4 = new Date(now);
    todayPlus4.setHours(now.getHours() + 4, 0, 0, 0);
    
    const formatTimePreset = (d: Date) => {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };
    
    const getDayNamePreset = (d: Date) => {
      return d.toLocaleDateString('en-US', { weekday: 'long' });
    };

    const tomorrowPreset = new Date(now);
    tomorrowPreset.setDate(now.getDate() + 1);
    tomorrowPreset.setHours(10, 0, 0, 0);

    const getBusinessDaysAfterPreset = (days: number) => {
      let result = new Date(now);
      let added = 0;
      while (added < days) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay();
        if (day !== 0 && day !== 6) {
          added++;
        }
      }
      result.setHours(10, 0, 0, 0);
      return result;
    };

    const bus2Preset = getBusinessDaysAfterPreset(2);
    const bus6Preset = getBusinessDaysAfterPreset(6);

    return [
      { label: 'Today', sublabel: `at ${formatTimePreset(todayPlus2)}`, date: todayPlus2 },
      { label: 'Today', sublabel: `at ${formatTimePreset(todayPlus4)}`, date: todayPlus4 },
      { label: 'Tomorrow', sublabel: getDayNamePreset(tomorrowPreset), date: tomorrowPreset },
      { label: '2 business days', sublabel: getDayNamePreset(bus2Preset), date: bus2Preset },
      { label: '6 business days', sublabel: getDayNamePreset(bus6Preset), date: bus6Preset },
    ];
  };

  const formatFollowupDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const hasFollowup = lead && lead.followup_date;

  useEffect(() => {
    if (!conversation) return
    setLoading(true)
    fetch(`/api/sheets?phone=${conversation.phone_number}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && !data.error) {
          setSheetData(data)
          const { 
            notes, Notes, stage, Stage, 
            followup_date, followup_notes, followup_notified,
            ...cleanedData 
          } = data
          onLeadUpdate(cleanedData)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [conversation?.phone_number])

  // Load existing notes when conversation changes
  useEffect(() => {
    if (!conversation) return
    setNotes((conversation as any).notes || '')
    setNotesSaved(false)
  }, [conversation?.id])

  const handleSaveNotes = async () => {
    if (!conversation) return
    setSavingNotes(true)
    try {
      await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      })
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save notes:', err)
    } finally {
      setSavingNotes(false)
    }
  }

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
    <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 relative">
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
            {/* Quick Actions (Call Button) */}
            <div className="flex gap-2 mb-2">
              <a
                href={`tel:${data.Phone}`}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow"
              >
                <Phone className="w-3.5 h-3.5" />
                Call Lead
              </a>
            </div>

            <InfoCard icon={Phone} label="Phone Number" value={data.Phone} />
            <InfoCard icon={User} label="Name" value={data.Name} />
            <InfoCard icon={Target} label="Lead Type" value={data.Lead_Type} badge />
            <InfoCard icon={MapPin} label="City" value={data.city} />
            <InfoCard icon={Wrench} label="Machine Interest" value={data.machine_interest} />
            <InfoCard icon={Star} label="Lead Quality" value={data.lead_quality} badge colored />
            <InfoCard icon={TrendingUp} label="Lead Score" value={data.lead_score} badge colored />
            <InfoCard icon={CheckCircle} label="Callback Ready" value={data.callback_ready} badge />

            {/* Dynamically render all other client-specific custom columns */}
            {Object.entries(data).map(([key, value]) => {
              const standardKeys = [
                'Phone', 'Name', 'Lead_Type', 'city', 'machine_interest', 
                'lead_quality', 'lead_score', 'callback_ready', 'conversation_summary', 
                'followup_date', 'followup_notes', 'followup_notified', 'id', 'conversation_id', 'stage'
              ]
              if (standardKeys.includes(key) || !value) return null
              
              // Format label: e.g. "crop_requirement" -> "Crop Requirement"
              const formattedLabel = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              
              return (
                <InfoCard 
                  key={key} 
                  icon={Target} 
                  label={formattedLabel} 
                  value={String(value)} 
                />
              )
            })}

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

        {/* Follow-up Reminder Section */}
        <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Follow-up Reminder</p>
            </div>
            <button
              onClick={() => setShowFollowupModal(true)}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {hasFollowup ? 'Edit' : 'Set Followup'}
            </button>
          </div>
          
          {hasFollowup ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800/80">
                <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatFollowupDate(lead.followup_date)}
                </span>
              </div>
              {lead.followup_notes && (
                <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800/80">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Follow-up Notes</p>
                  <p className="whitespace-pre-wrap">{lead.followup_notes}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActivityType('followup_call')
                    setActivityDesc('Followup via Call')
                    setActivityNotes(lead.followup_notes || '')
                    setShowMarkDoneModal(true)
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Mark Done
                </button>
                <button
                  onClick={handleClearFollowup}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-dashed border-red-200 dark:border-red-950 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500 rounded-xl text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500 mb-2">No active follow-up reminder</p>
              <button
                onClick={() => setShowFollowupModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-950 rounded-lg text-xs font-medium transition-colors"
              >
                <Calendar className="w-3 h-3" />
                Schedule Reminder
              </button>
            </div>
          )}
        </div>

        {/* Timeline Section */}
        <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Timeline</p>
            </div>
            <button
              onClick={() => {
                setActivityType('manual')
                setActivityDesc('')
                setActivityNotes('')
                setShowAddActivityModal(true)
              }}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>

          <div className="relative pl-4 border-l border-gray-100 dark:border-gray-800 space-y-4 ml-2 py-1">
            {loadingActivities ? (
              <div className="flex justify-center py-4">
                <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
              </div>
            ) : activities.length > 0 ? (
              activities.map((act) => (
                <div key={act.id} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[21.5px] top-1.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-gray-900 shadow-sm" />
                  
                  <div className="flex flex-col space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">
                        {formatActivityDate(act.created_at)}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingActivity(act)
                            setActivityType(act.activity_type)
                            setActivityDesc(act.description)
                            setActivityNotes(act.notes || '')
                            setShowAddActivityModal(true)
                          }}
                          className="p-0.5 rounded text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="Edit Activity"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteActivity(act.id)}
                          className="p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          title="Delete Activity"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      {act.description}
                    </p>
                    {act.notes && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal bg-gray-50 dark:bg-gray-800/40 p-2 rounded-lg mt-1 border border-gray-100 dark:border-gray-800/30 whitespace-pre-wrap">
                        {act.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-2 text-xs text-gray-400 border border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
                No activities logged yet
              </div>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
                <StickyNote className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-semibold text-gray-900 dark:text-white">Notes</p>
            </div>
            <button
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                notesSaved
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-emerald-100 hover:text-emerald-700'
              }`}
            >
              {savingNotes ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              {notesSaved ? 'Saved!' : 'Save'}
            </button>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes about this lead..."
            rows={4}
            className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400 border border-gray-200 dark:border-gray-700"
          />
        </div>
      </div>

      {/* Bottom Sheet Modal for Set Followup */}
      {showFollowupModal && (
        <div className="absolute inset-0 bg-black/40 z-20 transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setShowFollowupModal(false)} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-950 rounded-t-3xl border-t border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-30 transition-transform duration-300 transform translate-y-0 flex flex-col space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFollowupModal(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Set follow up date</h4>
              </div>
              {modalDate && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                  {formatFollowupDate(modalDate.toISOString())}
                </span>
              )}
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 gap-2">
              {getPresets().map((preset, idx) => {
                const isSelected = modalDate && Math.abs(modalDate.getTime() - preset.date.getTime()) < 1000 * 60;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setModalDate(preset.date);
                      setCustomMode(false);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                      isSelected && !customMode
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-400 font-medium'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/80'
                    }`}
                  >
                    <span className="text-xs font-semibold">{preset.label}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{preset.sublabel}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setCustomMode(true);
                  if (!modalDate) setModalDate(new Date());
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  customMode
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-400 font-medium'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/80'
                }`}
              >
                <span className="text-xs font-semibold">Custom Date</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Choose Date/Time</span>
              </button>
            </div>

            {/* Custom Inputs */}
            {customMode && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    value={customDateVal}
                    onChange={(e) => {
                      setCustomDateVal(e.target.value);
                      updateCustomDateTime(e.target.value, customTimeVal);
                    }}
                    className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold mb-1 uppercase tracking-wider">Time</label>
                  <input
                    type="time"
                    value={customTimeVal}
                    onChange={(e) => {
                      setCustomTimeVal(e.target.value);
                      updateCustomDateTime(customDateVal, e.target.value);
                    }}
                    className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Follow-up Notes */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Add Notes</label>
              <textarea
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                placeholder="Enter notes about this follow-up..."
                rows={3}
                className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
              />
            </div>

            {/* Save Button */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowFollowupModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveFollowup}
                disabled={savingFollowup || !modalDate}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {savingFollowup ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Log Activity Modal */}
      {showAddActivityModal && (
        <div className="absolute inset-0 bg-black/40 z-20 transition-opacity duration-300">
          <div className="absolute inset-0" onClick={closeActivityModal} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-950 rounded-t-3xl border-t border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-30 transition-transform duration-300 transform translate-y-0 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={closeActivityModal}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">{editingActivity ? 'Edit Activity' : 'Log Activity'}</h4>
              </div>
            </div>

            {/* Selector Grid */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { type: 'followup_call', label: 'Call', desc: 'Followup via Call' },
                { type: 'followup_whatsapp', label: 'WhatsApp', desc: 'Followup via WhatsApp' },
                { type: 'manual', label: 'Other', desc: 'Manual Note' }
              ].map((item) => {
                const isSelected = activityType === item.type
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setActivityType(item.type)
                      setActivityDesc(item.desc)
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-400 font-medium'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/80'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* Custom Description Input */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Description</label>
              <input
                type="text"
                value={activityDesc}
                onChange={(e) => setActivityDesc(e.target.value)}
                placeholder="e.g. Followup via Call"
                className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Notes Textarea */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Notes</label>
              <textarea
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                placeholder="Enter notes/summary of the activity..."
                rows={3}
                className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={closeActivityModal}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={editingActivity ? handleUpdateActivity : handleAddManualActivity}
                disabled={savingActivity || !activityDesc.trim()}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {savingActivity ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Followup Modal */}
      {showMarkDoneModal && (
        <div className="absolute inset-0 bg-black/40 z-20 transition-opacity duration-300">
          <div className="absolute inset-0" onClick={() => setShowMarkDoneModal(false)} />
          
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-950 rounded-t-3xl border-t border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-30 transition-transform duration-300 transform translate-y-0 flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMarkDoneModal(false)}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">Complete Followup</h4>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-normal">
              Marking this reminder as done will log it to the lead timeline and clear the active alert.
            </p>

            {/* Selector Grid */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'followup_call', label: 'Followup via Call', desc: 'Followup via Call' },
                { type: 'followup_whatsapp', label: 'Followup via WhatsApp', desc: 'Followup via WhatsApp' }
              ].map((item) => {
                const isSelected = activityType === item.type
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setActivityType(item.type)
                      setActivityDesc(item.desc)
                    }}
                    className={`p-3 rounded-2xl border text-xs font-semibold text-center transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-400 font-medium'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/80'
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* Custom Notes Textarea */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">Followup Summary / Notes</label>
              <textarea
                value={activityNotes}
                onChange={(e) => setActivityNotes(e.target.value)}
                placeholder="Describe how the follow-up went..."
                rows={3}
                className="w-full text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none placeholder-gray-400"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowMarkDoneModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkFollowupDone}
                disabled={savingActivity}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                {savingActivity ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Confirm Done
              </button>
            </div>
          </div>
        </div>
      )}
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
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
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
