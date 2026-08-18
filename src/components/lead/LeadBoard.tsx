'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import LeadColumn from './LeadColumn'
import LeadCard from './LeadCard'

const COLUMNS = [
  { id: 'new', title: 'New', headerBg: 'bg-teal-700', colorClass: 'border-t-teal-700' },
  { id: 'processing', title: 'Processing', headerBg: 'bg-indigo-900', colorClass: 'border-t-indigo-900' },
  { id: 'close_by', title: 'Close-by', headerBg: 'bg-lime-600', colorClass: 'border-t-lime-600' },
  { id: 'confirm', title: 'Confirm', headerBg: 'bg-green-800', colorClass: 'border-t-green-800' },
  { id: 'cancel', title: 'Cancel', headerBg: 'bg-red-600', colorClass: 'border-t-red-600' },
]

export default function LeadBoard() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    try {
      const res = await fetch('/api/leads')
      const data = await res.json()
      if (Array.isArray(data)) {
        setLeads(data)
      } else {
        // Fallback if API returns single object or error
        const { data: dbData } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
        if (dbData) setLeads(dbData)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDrop(leadId: string, newStage: string) {
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))

    // Determine the correct unique identifier to update. The leads table might use `id` or `conversation_id`.
    // Let's use Supabase directly for simplicity and robustness since the API expects conversation_id
    await supabase.from('leads').update({ stage: newStage }).eq('id', leadId)
    // We should also sync it back to conversations table if needed, but that's handled by trigger or API.
  }

  async function handleDelete(leadId: string) {
    if (!confirm('Are you sure you want to delete this lead?')) return
    
    // Optimistic update
    setLeads(prev => prev.filter(l => l.id !== leadId))
    await supabase.from('leads').delete().eq('id', leadId)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-x-auto gap-4 pb-4">
      {COLUMNS.map(col => {
        const columnLeads = leads.filter(l => (l.stage || 'new') === col.id)
        
        return (
          <LeadColumn
            key={col.id}
            title={col.title}
            count={columnLeads.length}
            headerBg={col.headerBg}
            colorClass={col.colorClass}
            onDrop={(leadId) => handleDrop(leadId, col.id)}
          >
            {columnLeads.map(lead => (
              <LeadCard key={lead.id} lead={lead} onDelete={handleDelete} />
            ))}
          </LeadColumn>
        )
      })}
    </div>
  )
}
