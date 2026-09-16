'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Search, 
  Filter, 
  Download, 
  MessageSquare, 
  Tag, 
  Eye, 
  X, 
  TrendingUp, 
  Calendar, 
  Phone, 
  User, 
  Check, 
  Trash2,
  RefreshCw,
  AlertCircle,
  ChevronDown
} from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { useOrg } from '@/contexts/OrgContext'
import { useRouter } from 'next/navigation'

interface Lead {
  id: string
  conversation_id: string
  phone_number: string
  customer_name?: string | null
  name?: string | null
  created_at: string
  updated_at?: string
  stage?: string | null
  lead_quality?: string | null
  lead_score?: number | null
  lead_temperature?: string | null
  lead_type?: string | null
  notes?: string | null
  followup_date?: string | null
  followup_notes?: string | null
  metadata?: any
}

const STAGES = ['new', 'interested', 'booking', 'confirmed', 'cancelled', 'completed', 'followup', 'not_interested', 'call_done', 'low_budget', 'hot_customer', 'not_connected', 'joined', 'not_joined', 'contact_save', 'contact_not_save', 'unknown']

const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  interested: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50',
  booking: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50',
  confirmed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50',
  completed: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50',
  followup: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border border-cyan-200/50',
  not_interested: 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200/50',
  call_done: 'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/50',
  low_budget: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50',
  hot_customer: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200/50',
  not_connected: 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border border-gray-300/50',
  joined: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  not_joined: 'bg-zinc-150 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  contact_save: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  contact_not_save: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const QUALITY_COLORS: Record<string, string> = {
  HOT: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200/50',
  WARM: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50',
  COLD: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50',
  SUPPRESSED: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200/50',
}

export const dynamic = 'force-dynamic'

export default function LeadsPage() {
  const { profile, loading: authLoading } = useOrg()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login')
  }, [profile, authLoading, router])

  if (authLoading || !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return <LeadsContent />
}

import { classifyOsmoContact } from '@/lib/osmoPhonebooks'

function classifyLead(lead: Lead): 'osmo_dealer' | 'dealer' | 'customer' | 'unfiltered' {
  return classifyOsmoContact(lead)
}

function LeadsContent() {
  const { profile, org } = useOrg()
  const isOsmoRo = 
    profile?.email?.toLowerCase() === 'paanifilter9@gmail.com' ||
    org?.name?.toLowerCase().includes('osmo') ||
    org?.slug?.toLowerCase().includes('osmo')

  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Pagination
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Stats
  const [stats, setStats] = useState({ total: 0, unfiltered: 0, osmo_dealer: 0, dealer: 0, customer: 0, hot: 0, warm: 0, followups: 0 })
  
  // Filters
  const [search, setSearch] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedQuality, setSelectedQuality] = useState('')
  const [leadTypeFilter, setLeadTypeFilter] = useState<string>('unfiltered') // unfiltered, osmo_dealer, dealer, customer
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  
  // Selected Lead for Details Drawer
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  
  // Edit State inside Drawer
  const [editStage, setEditStage] = useState('')
  const [editQuality, setEditQuality] = useState('')
  const [editScore, setEditScore] = useState(0)
  const [editCategory, setEditCategory] = useState('unfiltered')
  const [savingLead, setSavingLead] = useState(false)

  // Stats loaded from server
  const typeCounts = {
    unfiltered: stats.unfiltered,
    osmo_dealer: stats.osmo_dealer,
    dealer: stats.dealer,
    customer: stats.customer,
  }

  const fetchStats = async (headers: any, params: URLSearchParams) => {
    try {
      const res = await fetch(`/api/leads/stats?${params.toString()}`, { headers, cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (e) {
      console.error('Failed to fetch stats', e)
    }
  }

  const fetchLeads = async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setPage(1)
    }
    setError(null)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const headers = { 'Authorization': `Bearer ${token}` }

      const statsParams = new URLSearchParams()
      if (selectedStage) statsParams.set('stage', selectedStage)
      if (selectedQuality) statsParams.set('quality', selectedQuality)
      if (search) statsParams.set('search', search)
      if (startDate) statsParams.set('start_date', startDate)
      if (endDate) statsParams.set('end_date', endDate)

      if (!loadMore) {
        // Fetch stats across all categories for tab counts & metrics
        fetchStats(headers, statsParams)
      }

      const params = new URLSearchParams(statsParams)
      if (leadTypeFilter !== 'all') params.set('lead_type', leadTypeFilter)

      const currentPage = loadMore ? page + 1 : 1
      params.set('page', currentPage.toString())
      params.set('limit', '50')

      const res = await fetch(`/api/leads/list?${params}`, { headers, cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch leads list')
      const { data, hasMore: more } = await res.json()
      
      if (loadMore) {
        setLeads(prev => [...prev, ...data])
        setPage(currentPage)
      } else {
        setLeads(data)
      }
      setHasMore(more)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An error occurred while loading leads.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchLeads(false)
  }, [selectedStage, selectedQuality, startDate, endDate, leadTypeFilter])

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      fetchLeads(false)
    }
  }

  // Quick category change directly from table
  const handleQuickCategoryChange = async (lead: Lead, newCategory: string) => {
    // Instant optimistic update
    setLeads(prev => prev.map(l => {
      if (l.id === lead.id || (l.phone_number && lead.phone_number && l.phone_number === lead.phone_number)) {
        const currentMeta = typeof l.metadata === 'string' ? JSON.parse(l.metadata || '{}') : (l.metadata || {})
        return {
          ...l,
          lead_type: newCategory,
          metadata: { ...currentMeta, lead_type: newCategory, category: newCategory }
        }
      }
      return l
    }))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      
      fetch('/api/leads', {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: lead.id,
          conversation_id: lead.conversation_id,
          phone_number: lead.phone_number,
          lead_type: newCategory
        })
      }).catch(console.error)
    } catch (err) {
      console.error('Failed to change lead category:', err)
    }
  }

  // Save Lead changes (Stage / Quality / Score / Category)
  const handleUpdateLead = async () => {
    if (!activeLead) return
    setSavingLead(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      const updates: any = {
        id: activeLead.id,
        conversation_id: activeLead.conversation_id,
        phone_number: activeLead.phone_number,
        stage: editStage,
        lead_quality: editQuality || null,
        lead_score: editScore,
        lead_type: editCategory
      }

      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates)
      })

      if (!res.ok) throw new Error('Failed to update lead')
      
      const currentMeta = typeof activeLead.metadata === 'string' ? JSON.parse(activeLead.metadata || '{}') : (activeLead.metadata || {})
      const mergedMeta = { ...currentMeta, lead_type: editCategory, category: editCategory }
      
      // Update local state list
      setLeads(prev => prev.map(l => (l.id === activeLead.id || (l.phone_number && activeLead.phone_number && l.phone_number === activeLead.phone_number)) ? { ...l, ...updates, metadata: mergedMeta } : l))
      setActiveLead(prev => prev ? { ...prev, ...updates, metadata: mergedMeta } : null)
    } catch (err) {
      console.error(err)
      alert('Failed to update lead settings.')
    } finally {
      setSavingLead(false)
    }
  }

  // Open Details Drawer
  const handleViewLead = (lead: Lead) => {
    let meta = (lead.metadata || {}) as Record<string, any>;
    if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch (e) { meta = {} } }
    const score = Number(meta.lead_score ?? lead.lead_score) || 0;
    const stage = meta.state || meta.stage || lead.stage || 'new';
    const quality = meta.lead_quality || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : score > 0 ? 'cold' : lead.lead_quality || 'unknown');
    
    setActiveLead({ ...lead, metadata: meta })
    setEditStage(stage)
    setEditQuality(quality)
    setEditScore(score)
    setEditCategory(classifyLead(lead))
  }

  // Download filtered leads as CSV
  const handleDownloadCSV = () => {
    if (leads.length === 0) return

    // Standard columns
    const standardHeaders = ['Name', 'Phone', 'Stage', 'Lead Quality', 'Lead Score', 'Created At']

    // Unique keys in metadata
    const metadataKeys = new Set<string>()
    leads.forEach(l => {
      let meta = l.metadata || {};
      if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch (e) {} }
      if (meta) {
        Object.keys(meta).forEach(k => metadataKeys.add(k))
      }
    })

    const allHeaders = [...standardHeaders, ...Array.from(metadataKeys)]
    const csvRows = []

    // Header row
    csvRows.push(allHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(','))

    // Data rows
    leads.forEach(l => {
      let meta = l.metadata || {};
      if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch (e) {} }
      const score = Number(meta.lead_score ?? l.lead_score) || 0;
      const quality = meta.lead_quality || (score >= 70 ? 'hot' : score >= 40 ? 'warm' : score > 0 ? 'cold' : l.lead_quality || 'unknown');
      const stage = meta.state || meta.stage || l.stage || 'new';

      const row = [
        l.name || (l as any).customer_name || meta.name || meta.contact_person || 'Unknown',
        l.phone_number || '',
        stage,
        quality,
        String(score),
        l.created_at ? new Date(l.created_at).toLocaleString() : ''
      ]

      metadataKeys.forEach(k => {
        row.push(meta?.[k] || '')
      })

      csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    })

    const csvContent = csvRows.join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `leads_crm_export_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Use stats from server for accurate metrics across all leads
  const totalLeads = stats.total
  const hotLeads = stats.hot ?? 0
  const warmLeads = stats.warm ?? 0
  const followupLeads = stats.followups ?? 0

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 overflow-hidden text-gray-900 dark:text-gray-100">
      
      {/* Header Banner */}
      <header className="h-16 shrink-0 flex items-center justify-between px-6 z-50 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm transition-all">
        <div className="flex items-center gap-3">
          <Sidebar />
          <span className="text-gray-900 dark:text-white font-bold text-lg flex items-center gap-2 tracking-tight">
            <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Lead CRM Portal
          </span>
          <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/50 dark:bg-emerald-900/30 border border-emerald-200/50 dark:border-emerald-800/50 rounded-full px-2.5 py-0.5 ml-2 tracking-wider">
            {org?.name || 'Tenant System'}
          </span>
        </div>

        <button
          onClick={handleDownloadCSV}
          disabled={leads.length === 0}
          className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-bold rounded-xl shadow-sm border border-gray-200/50 dark:border-gray-800/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative z-0">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-6">
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <MetricCard label="Total CRM Leads" value={totalLeads} bgGradient="from-blue-500 to-indigo-600" shadowColor="shadow-blue-500/20" icon={<User className="w-5 h-5 text-blue-100" />} />
            <MetricCard label="Hot Status Leads" value={hotLeads} bgGradient="from-rose-500 to-red-600" shadowColor="shadow-rose-500/20" icon={<TrendingUp className="w-5 h-5 text-rose-100" />} />
            <MetricCard label="Warm Status Leads" value={warmLeads} bgGradient="from-amber-400 to-orange-500" shadowColor="shadow-amber-500/20" icon={<AlertCircle className="w-5 h-5 text-amber-100" />} />
            <MetricCard label="Active Follow-ups" value={followupLeads} bgGradient="from-emerald-400 to-teal-500" shadowColor="shadow-teal-500/20" icon={<Calendar className="w-5 h-5 text-emerald-100" />} />
          </div>

          {/* Filtering Controls */}
          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-md p-4 rounded-2xl border border-white dark:border-gray-800/50 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between transition-all">
            <div className="relative w-full md:w-80">
              <input
                type="text"
                placeholder="Search leads, crop, tehsil, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyPress}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50/50 dark:bg-gray-950/50 border border-gray-200/60 dark:border-gray-800/60 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-gray-400"
              />
              <Search className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3.5" />
            </div>

            <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
              {/* Stage Filter */}
              <div className="flex items-center gap-1.5 bg-gray-50/50 dark:bg-gray-950/50 border border-gray-200/60 dark:border-gray-800/60 px-4 py-2 rounded-xl w-1/2 md:w-auto shrink-0 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                <Filter className="w-4 h-4 text-emerald-500" />
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer w-full"
                >
                  <option value="">All Stages</option>
                  {STAGES.map(s => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>

              {/* Quality Filter */}
              <div className="flex items-center gap-1.5 bg-gray-50/50 dark:bg-gray-950/50 border border-gray-200/60 dark:border-gray-800/60 px-4 py-2 rounded-xl w-1/2 md:w-auto shrink-0 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                <Tag className="w-4 h-4 text-emerald-500" />
                <select
                  value={selectedQuality}
                  onChange={(e) => setSelectedQuality(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer w-full"
                >
                  <option value="">All Qualities</option>
                  <option value="hot">HOT</option>
                  <option value="warm">WARM</option>
                  <option value="cold">COLD</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2 bg-gray-50/50 dark:bg-gray-950/50 border border-gray-200/60 dark:border-gray-800/60 px-4 py-2 rounded-xl w-full md:w-auto shrink-0 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                <Calendar className="w-4 h-4 text-emerald-500 shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                  title="Start Date"
                />
                <span className="text-gray-300 dark:text-gray-700 text-xs shrink-0 font-bold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                  title="End Date"
                />
              </div>

              <button
                onClick={() => fetchLeads(false)}
                className="hidden md:flex items-center justify-center gap-1.5 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:shadow-lg hover:-translate-y-0.5"
              >
                Apply
              </button>
            </div>
          </div>

          {/* Quick Tap Category Tabs (Osmo RO Dashboard: Paanifilter9@gmail.com) */}
          {isOsmoRo && (
            <div className="grid grid-cols-4 gap-3 p-2 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md rounded-2xl border border-white dark:border-gray-800/50 shadow-sm transition-all">
              {[
                { id: 'unfiltered', label: 'Unfiltered', count: typeCounts.unfiltered, activeStyle: 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md shadow-slate-500/30' },
                { id: 'osmo_dealer', label: 'Osmo Dealer', count: typeCounts.osmo_dealer, activeStyle: 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md shadow-purple-500/30' },
                { id: 'dealer', label: 'Dealer', count: typeCounts.dealer, activeStyle: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30' },
                { id: 'customer', label: 'Customer', count: typeCounts.customer, activeStyle: 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-md shadow-teal-500/30' },
              ].map((tab) => {
                const active = leadTypeFilter === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLeadTypeFilter(tab.id)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[11px] uppercase tracking-wider font-black transition-all duration-300 select-none cursor-pointer ${
                      active
                        ? tab.activeStyle
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-lg font-black ${
                      active && tab.id !== 'all'
                        ? 'bg-white/25 text-white shadow-inner'
                        : 'bg-gray-200/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* CRM Leads Table */}
          <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-md rounded-2xl border border-white/50 dark:border-gray-800/50 shadow-sm overflow-hidden flex-1 flex flex-col min-h-[350px] transition-all relative">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mb-2" />
                <p className="text-sm text-gray-500">Loading leads from CRM database...</p>
              </div>
            ) : error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-red-500">
                <AlertCircle className="w-10 h-10 mb-2" />
                <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">{error}</p>
                <button onClick={() => fetchLeads(false)} className="mt-3 px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors border border-red-200">
                  Try Again
                </button>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mb-2" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">No Leads Found</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-xs">Adjust your search parameters or check your n8n workflow connections.</p>
              </div>
            ) : (() => {
              const displayedLeads = leads // Server handles filtering now

              if (displayedLeads.length === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mb-2" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">No Leads in this Category</h4>
                    <p className="text-xs text-gray-500 mt-1 max-w-xs">No leads match the selected category filter.</p>
                  </div>
                )
              }

              const skipKeys = [
                'id', 'created_at', 'updated_at', 'org_id', 'assigned_to', 
                'phone_number', 'name', 'conversation_id',
                'followup_notes', 'followup_date', 'followup_notified',
                'metadata', 'lead_type'
              ];

              const priorityOrder = [
                'lead_score', 'lead_quality', 'state', 'industry', 'business_intent', 
                'business_type', 'business_name', 'contact_person', 'city', 'email', 
                'demo_selected', 'pricing_requested', 'consultation_ready'
              ];

              // Always include core standard CRM keys so columns never disappear
              const standardKeys = [
                'lead_score', 'lead_quality', 'state', 'industry', 'business_intent'
              ];

              // Collect all unique custom keys across leads (merging top-level and metadata)
              const rawKeys = Array.from(new Set([
                ...standardKeys,
                ...displayedLeads.flatMap(lead => {
                  let meta = (lead.metadata || {}) as Record<string, any>;
                  if (typeof meta === 'string') {
                    try { meta = JSON.parse(meta) } catch (e) { meta = {} }
                  }
                  const combined = { ...lead, ...meta } as Record<string, any>;
                  return Object.keys(combined).filter(key => {
                    if (skipKeys.includes(key.toLowerCase())) return false;
                    const val = combined[key];
                    if (typeof val === 'object' || val === null || val === undefined || String(val).trim() === '') return false;
                    return true;
                  });
                })
              ]));

              // Sort keys so high-priority CRM fields (Score, Quality, State, Industry) appear first
              const uniqueCustomKeys = rawKeys.sort((a, b) => {
                const idxA = priorityOrder.indexOf(a.toLowerCase());
                const idxB = priorityOrder.indexOf(b.toLowerCase());
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
              });

              return (
                <div className="overflow-x-auto flex-1 pb-4">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                    <thead className="bg-emerald-50/50 dark:bg-emerald-950/30 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 tracking-widest text-left uppercase sticky top-0 z-20 backdrop-blur-md">
                      <tr>
                        <th className="px-6 py-4 whitespace-nowrap sticky left-0 bg-emerald-50/90 dark:bg-emerald-950/90 backdrop-blur-xl z-30 shadow-[inset_-1px_0_0_0_rgba(16,185,129,0.2)] dark:shadow-[inset_-1px_0_0_0_rgba(16,185,129,0.1)]">Lead Contact</th>
                        {uniqueCustomKeys.map(key => (
                          <th key={key} className="px-6 py-4 whitespace-nowrap">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </th>
                        ))}
                        <th className="px-6 py-4 whitespace-nowrap">Date Added</th>
                        <th className="px-6 py-4 text-right whitespace-nowrap sticky right-0 bg-emerald-50/90 dark:bg-emerald-950/90 backdrop-blur-xl z-30 shadow-[inset_1px_0_0_0_rgba(16,185,129,0.2)] dark:shadow-[inset_1px_0_0_0_rgba(16,185,129,0.1)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60 text-sm">
                      {displayedLeads.map((lead) => {
                        let rawFollowup = lead.followup_notes || '';
                        if (rawFollowup.includes('Scheduled Meeting')) {
                          rawFollowup = 'Scheduled Meeting';
                        }

                        let meta = (lead.metadata || {}) as Record<string, any>;
                        if (typeof meta === 'string') {
                          try { meta = JSON.parse(meta) } catch (e) { meta = {} }
                        }

                        // Merge lead with metadata so metadata overrides stale columns
                        const allCustomData = { ...lead, ...meta } as Record<string, any>;

                        // Dynamically derive quality/temperature from score if available
                        const metaScore = Number(allCustomData.lead_score) || 0;
                        if (metaScore >= 70) {
                          allCustomData.lead_temperature = 'HOT';
                          allCustomData.lead_quality = 'HOT';
                        } else if (metaScore >= 40) {
                          allCustomData.lead_temperature = 'WARM';
                          allCustomData.lead_quality = 'WARM';
                        } else if (metaScore > 0) {
                          allCustomData.lead_temperature = 'COLD';
                          allCustomData.lead_quality = 'COLD';
                        }

                        const displayName = lead.name || (lead as any).customer_name || allCustomData.Name || allCustomData.name || allCustomData.contact_person || allCustomData.customer_name || 'Unknown';

                        return (
                          <tr 
                            key={lead.id} 
                            className="group hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition-all cursor-pointer relative"
                            onClick={() => handleViewLead(lead)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl group-hover:bg-emerald-50/60 dark:group-hover:bg-emerald-900/20 transition-colors z-10 shadow-[inset_-1px_0_0_0_#f3f4f6] dark:shadow-[inset_-1px_0_0_0_#1f2937]">
                              <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>{displayName}</span>
                                {isOsmoRo && (
                                  <div className="relative inline-flex items-center ml-1" onClick={(e) => e.stopPropagation()}>
                                    <select
                                      value={classifyLead(lead)}
                                      onChange={(e) => handleQuickCategoryChange(lead, e.target.value)}
                                      className={`text-[9px] font-bold pl-1.5 pr-3.5 py-0.5 rounded-full uppercase tracking-wider border cursor-pointer appearance-none focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm ${
                                        classifyLead(lead) === 'osmo_dealer' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800' :
                                        classifyLead(lead) === 'dealer' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
                                        classifyLead(lead) === 'customer' ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border-teal-200 dark:border-teal-800' :
                                        'bg-gray-150 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-750'
                                      }`}
                                      title="Change Category (Osmo Dealer, Dealer, Customer, Unfiltered)"
                                    >
                                      <option value="unfiltered">Unfiltered</option>
                                      <option value="osmo_dealer">Osmo Dealer</option>
                                      <option value="dealer">Dealer</option>
                                      <option value="customer">Customer</option>
                                    </select>
                                    <ChevronDown className="w-2 h-2 absolute right-1 pointer-events-none opacity-60" />
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {lead.phone_number}
                              </div>
                              {rawFollowup && <div className="text-cyan-600 dark:text-cyan-400 text-[10px] truncate font-medium mt-1">📌 {rawFollowup}</div>}
                            </td>

                            {uniqueCustomKeys.map(key => {
                              const val = allCustomData[key];
                              const displayVal = val !== undefined && val !== null ? String(val) : '-';
                              const truncatedVal = displayVal.length > 50 ? displayVal.substring(0, 50) + '...' : displayVal;
                              
                              if (key.toLowerCase() === 'lead_score') {
                                 const score = Number(val ?? allCustomData.lead_score) || 0;
                                 return (
                                   <td key={key} className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                                          <div 
                                            className={`h-1.5 rounded-full ${score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-amber-500' : 'bg-blue-500'}`} 
                                            style={{ width: `${Math.min(100, Math.max(0, score))}%` }} 
                                          />
                                        </div>
                                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                                          score >= 70 ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' : 
                                          score >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' : 
                                          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                        }`}>
                                          {score}
                                        </span>
                                      </div>
                                   </td>
                                 )
                              }
                              if (key.toLowerCase() === 'lead_quality' || key.toLowerCase() === 'lead_temperature') {
                                const qVal = String(val || allCustomData.lead_quality || allCustomData.lead_temperature || (metaScore >= 70 ? 'HOT' : metaScore >= 40 ? 'WARM' : 'COLD')).toUpperCase();
                                return (
                                   <td key={key} className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${QUALITY_COLORS[qVal] || 'bg-gray-100 text-gray-600'}`}>
                                        {qVal}
                                      </span>
                                   </td>
                                )
                              }
                              if (key.toLowerCase() === 'stage' || key.toLowerCase() === 'state') {
                                const sVal = String(val || allCustomData.state || allCustomData.stage || 'new').toLowerCase();
                                return (
                                   <td key={key} className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_COLORS[sVal] || 'bg-gray-100 text-gray-700'}`}>
                                        {sVal.replace(/_/g, ' ')}
                                      </span>
                                   </td>
                                )
                              }

                              return (
                                <td key={key} className="px-6 py-4 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300">
                                  {truncatedVal !== '-' ? (
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                      {truncatedVal}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 dark:text-gray-700">-</span>
                                  )}
                                </td>
                              )
                            })}
                            
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(lead.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs sticky right-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl group-hover:bg-emerald-50/60 dark:group-hover:bg-emerald-900/20 transition-colors z-10 shadow-[inset_1px_0_0_0_#f3f4f6] dark:shadow-[inset_1px_0_0_0_#1f2937]" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleViewLead(lead)}
                                className="px-4 py-1.5 bg-white dark:bg-gray-800 text-emerald-600 hover:text-white hover:bg-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-500 dark:hover:text-white rounded-lg border border-emerald-200 dark:border-emerald-800/50 font-bold shadow-sm transition-all duration-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 flex items-center gap-1 ml-auto"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  
                  {hasMore && (
                    <div className="flex justify-center p-4 pt-6 pb-8 border-t border-gray-100 dark:border-gray-800/60 relative">
                      <button 
                        onClick={() => fetchLeads(true)}
                        disabled={loadingMore}
                        className="px-6 py-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-sm rounded-xl border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                      >
                        {loadingMore ? (
                          <><RefreshCw className="w-4 h-4 animate-spin" /> Loading...</>
                        ) : (
                          'Load More Leads'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

        </div>

        {/* Lead details Drawer (Opens on Right side) */}
        {activeLead && (
          <div className="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-md z-30 flex justify-end transition-opacity duration-300">
            {/* Click outside to close */}
            <div className="flex-1 cursor-pointer" onClick={() => setActiveLead(null)} />
            
            <div className="w-full max-w-md bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl h-full shadow-2xl flex flex-col border-l border-white/20 dark:border-gray-800/50 rounded-l-3xl animate-slide-in overflow-hidden">
              
              {/* Drawer Header */}
              <div className="p-5 border-b border-gray-200/60 dark:border-gray-800/60 bg-transparent flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-black tracking-tight text-gray-900 dark:text-white text-lg">Lead Summary</span>
                </div>
                <button 
                  onClick={() => setActiveLead(null)}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8 hide-scrollbar">
                
                {/* Details Section */}
                <div className="space-y-4">
                  <div className="text-center pb-5 border-b border-gray-100 dark:border-gray-800/50">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{activeLead.name || 'Unknown'}</h3>
                    <p className="text-sm text-gray-500 flex items-center justify-center gap-1.5 mt-1 font-mono">
                      <Phone className="w-3.5 h-3.5" />
                      {activeLead.phone_number}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Database ID</span>
                      <p className="text-xs text-gray-900 dark:text-gray-100 font-mono truncate mt-1">{activeLead.id}</p>
                    </div>
                    <div className="p-3 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 shadow-sm">
                      <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Created Date</span>
                      <p className="text-xs text-gray-900 dark:text-gray-100 font-medium mt-1">
                        {new Date(activeLead.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Edit Section */}
                <div className="space-y-5 p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800/80 shadow-xl shadow-gray-200/20 dark:shadow-black/40">
                  <h4 className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">CRM Management</h4>

                  <div className="space-y-3">
                    {/* Stage selector */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Lead Stage</label>
                      <select
                        value={editStage}
                        onChange={(e) => setEditStage(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg text-sm focus:outline-none"
                      >
                        {STAGES.map(s => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ').toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quality selector */}
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Lead Quality</label>
                      <select
                        value={editQuality}
                        onChange={(e) => setEditQuality(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg text-sm focus:outline-none"
                      >
                        <option value="unknown">UNKNOWN</option>
                        <option value="hot">HOT</option>
                        <option value="warm">WARM</option>
                        <option value="cold">COLD</option>
                      </select>
                    </div>

                    {/* Category selector (Osmo RO only) */}
                    {isOsmoRo && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Lead Category</label>
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="w-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg text-sm focus:outline-none font-semibold text-gray-900 dark:text-white"
                        >
                          <option value="unfiltered">⚪ Unfiltered (Undefined)</option>
                          <option value="osmo_dealer">🟣 Osmo Dealer</option>
                          <option value="dealer">🟠 Dealer / Retailer</option>
                          <option value="customer">🟢 Customer</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleUpdateLead}
                    disabled={savingLead}
                    className="w-full mt-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition-all disabled:opacity-50"
                  >
                    {savingLead ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save Changes
                  </button>
                </div>

                {/* Metadata JSON Viewer */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wider">Dynamic Fields (Metadata)</h4>
                  
                  {Object.keys(activeLead.metadata || {}).length === 0 ? (
                    <p className="text-xs text-gray-500 italic p-3 bg-gray-50 dark:bg-gray-950 rounded-xl text-center border border-dashed">
                      No custom fields found.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {Object.entries(activeLead.metadata || {}).map(([key, val]) => {
                        const formattedLabel = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                        return (
                          <div 
                            key={key} 
                            className="p-4 bg-gray-50/50 dark:bg-gray-900/50 rounded-2xl border border-gray-200/50 dark:border-gray-800/50 shadow-sm flex items-center justify-between hover:bg-white dark:hover:bg-gray-900 transition-colors"
                          >
                            <div>
                              <span className="text-[10px] text-gray-400 block font-semibold">{formattedLabel}</span>
                              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                                {String(val) || <span className="text-gray-400 italic">empty</span>}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-gray-200/60 dark:border-gray-800/60 bg-white/50 dark:bg-gray-950/50 backdrop-blur-md flex gap-3 shrink-0">
                <Link
                  href={`/dashboard?phone=${activeLead.phone_number}`}
                  className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  Open Conversation Chat
                </Link>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function MetricCard({ label, value, bgGradient, shadowColor, icon }: { label: string; value: number; bgGradient: string; shadowColor: string; icon: React.ReactNode }) {
  return (
    <div className={`relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br ${bgGradient} shadow-lg ${shadowColor} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-white flex flex-col justify-between`}>
      {/* Abstract glass overlay */}
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -left-6 -bottom-6 w-20 h-20 bg-black/10 rounded-full blur-xl pointer-events-none" />
      
      <div className="relative z-10 flex items-center justify-between">
        <span className="text-xs uppercase font-bold text-white/80 tracking-widest">{label}</span>
        <div className="p-1.5 bg-white/20 rounded-xl backdrop-blur-sm">
          {icon}
        </div>
      </div>
      <span className="relative z-10 text-3xl font-black mt-2 tracking-tight">{value}</span>
    </div>
  )
}
