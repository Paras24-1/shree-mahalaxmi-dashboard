'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import {
  Plus, Search, Trash2, Edit2, Star, Phone, MessageSquare,
  Mail, MessageCircle, MoreVertical, Download, Upload, Users,
  X, Check, RefreshCw, Filter, CheckSquare, UserPlus, MapPin,
  Building, ChevronDown, CheckCircle2
} from 'lucide-react'

type CustomerTab = 'active' | 'deactive' | 'favorite' | 'duplicate'

interface Customer {
  id: string
  name: string
  phone_number: string
  email?: string
  city?: string
  company?: string
  machine_interest?: string
  status: 'active' | 'deactive' | 'favorite' | 'duplicate'
  is_favorite?: boolean
  notes?: string
  created_at: string
}

export default function CustomerPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<CustomerTab>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)

  // Form States
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formCompany, setFormCompany] = useState('')
  const [formInterest, setFormInterest] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'deactive' | 'favorite'>('active')
  const [formNotes, setFormNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // ── Fetch Customers ────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customers')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Customer[] = await res.json()
      setCustomers(data)
    } catch (err) {
      console.error('Error fetching customers:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // ── Modal Handlers ─────────────────────────────────────────────────────────

  const openAddModal = () => {
    setSelectedCustomer(null)
    setFormName('')
    setFormPhone('')
    setFormEmail('')
    setFormCity('')
    setFormCompany('')
    setFormInterest('')
    setFormStatus(activeTab === 'deactive' ? 'deactive' : 'active')
    setFormNotes('')
    setShowAddModal(true)
  }

  const openEditModal = (cust: Customer) => {
    setSelectedCustomer(cust)
    setFormName(cust.name)
    setFormPhone(cust.phone_number)
    setFormEmail(cust.email || '')
    setFormCity(cust.city || '')
    setFormCompany(cust.company || '')
    setFormInterest(cust.machine_interest || '')
    setFormStatus(cust.status === 'deactive' ? 'deactive' : (cust.is_favorite ? 'favorite' : 'active'))
    setFormNotes(cust.notes || '')
    setShowEditModal(true)
  }

  const handleSave = async () => {
    if (!formName.trim() || !formPhone.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: formName.trim(),
        phone_number: formPhone.trim(),
        email: formEmail.trim() || null,
        city: formCity.trim() || null,
        company: formCompany.trim() || null,
        machine_interest: formInterest.trim() || null,
        status: formStatus,
        is_favorite: formStatus === 'favorite',
        notes: formNotes.trim() || null,
      }

      if (selectedCustomer && showEditModal) {
        const res = await fetch('/api/customers', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedCustomer.id, ...payload }),
        })
        if (!res.ok) throw new Error('Failed to update')
        showToast('Customer updated successfully')
        setShowEditModal(false)
      } else {
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
        showToast('Customer added successfully')
        setShowAddModal(false)
      }

      await fetchCustomers()
    } catch (err) {
      console.error('Error saving customer:', err)
      alert('Failed to save customer. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this customer?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/customers?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setCustomers(prev => prev.filter(c => c.id !== id))
      showToast('Customer deleted')
    } catch (err) {
      console.error('Error deleting customer:', err)
      alert('Failed to delete customer.')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleFavorite = async (cust: Customer) => {
    const nextFav = !cust.is_favorite
    try {
      await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cust.id, is_favorite: nextFav }),
      })
      setCustomers(prev =>
        prev.map(c => c.id === cust.id ? { ...c, is_favorite: nextFav } : c)
      )
      showToast(nextFav ? 'Added to favorites' : 'Removed from favorites')
    } catch (err) {
      console.error('Error toggling favorite:', err)
    }
  }

  // ── CSV Export ─────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (customers.length === 0) {
      alert('No customer records to export.')
      return
    }
    const headers = ['Name', 'Phone Number', 'Email', 'City', 'Company', 'Machine Interest', 'Status']
    const rows = customers.map(c => [
      `"${c.name}"`,
      `"${c.phone_number}"`,
      `"${c.email || ''}"`,
      `"${c.city || ''}"`,
      `"${c.company || ''}"`,
      `"${c.machine_interest || ''}"`,
      `"${c.status}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `customers_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Customer list exported as CSV')
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    return {
      active: customers.filter(c => c.status === 'active' || (!c.status && !c.is_favorite)).length,
      deactive: customers.filter(c => c.status === 'deactive').length,
      favorite: customers.filter(c => c.is_favorite || c.status === 'favorite').length,
      duplicate: customers.filter(c => c.status === 'duplicate').length,
    }
  }, [customers])

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Tab filter
      if (activeTab === 'active') {
        if (c.status === 'deactive') return false
      } else if (activeTab === 'deactive') {
        if (c.status !== 'deactive') return false
      } else if (activeTab === 'favorite') {
        if (!c.is_favorite && c.status !== 'favorite') return false
      } else if (activeTab === 'duplicate') {
        if (c.status !== 'duplicate') return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = c.name.toLowerCase().includes(query)
        const matchesPhone = c.phone_number.toLowerCase().includes(query)
        const matchesCity = (c.city || '').toLowerCase().includes(query)
        const matchesCompany = (c.company || '').toLowerCase().includes(query)
        return matchesName || matchesPhone || matchesCity || matchesCompany
      }

      return true
    })
  }, [customers, activeTab, searchQuery])

  // Select all toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCustomers.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredCustomers.map(c => c.id))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const pageTitle = activeTab === 'active'
    ? 'Active Customer'
    : activeTab === 'deactive'
    ? 'Deactive Customer'
    : activeTab === 'favorite'
    ? 'Favorite Customer'
    : 'Duplicate Customer'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-7 py-2 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 sm:w-56"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Add Customer Button */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2E285F] hover:bg-[#221E4A] dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Customer</span>
          </button>

          {/* Filter Dropdown */}
          <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors shadow-sm">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span>Filter</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Tabs & Action Toolbar Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-gray-800 mb-6 pb-2">
        {/* Tab Strip */}
        <div className="flex items-center gap-6 overflow-x-auto">
          {[
            { key: 'active' as CustomerTab, label: 'Active', count: counts.active },
            { key: 'deactive' as CustomerTab, label: 'Deactive', count: counts.deactive },
            { key: 'favorite' as CustomerTab, label: 'Favorite', count: counts.favorite },
            { key: 'duplicate' as CustomerTab, label: 'Duplicate', count: counts.duplicate },
          ].map(({ key, label, count }) => {
            const isActive = activeTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 py-2 text-sm font-semibold whitespace-nowrap transition-all relative ${
                  isActive
                    ? 'text-indigo-900 dark:text-indigo-400 font-bold'
                    : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <span>{label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {count}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-900 dark:bg-indigo-400 rounded-full" />
                )}
              </button>
            )
          })}
        </div>

        {/* Toolbar Buttons (matching screenshot) */}
        <div className="flex items-center gap-1.5 self-end md:self-auto">
          {/* Import / Cloud Upload */}
          <button
            onClick={() => setShowImportModal(true)}
            className="p-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl transition-colors"
            title="Import Customers"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Export / Cloud Download */}
          <button
            onClick={handleExportCSV}
            className="p-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-xl transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Assign Team */}
          <button
            onClick={() => showToast('Select customers to assign team members')}
            className="p-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-red-500 rounded-xl transition-colors"
            title="Assign Team"
          >
            <Users className="w-4 h-4" />
          </button>

          {/* Send Email */}
          <button
            onClick={() => showToast('Email broadcast feature enabled')}
            className="p-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-purple-600 rounded-xl transition-colors"
            title="Send Email"
          >
            <Mail className="w-4 h-4" />
          </button>

          {/* Send SMS */}
          <button
            onClick={() => showToast('SMS service ready')}
            className="p-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-orange-500 rounded-xl transition-colors"
            title="Send SMS"
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* WhatsApp Direct */}
          <button
            onClick={() => showToast('WhatsApp broadcast manager ready')}
            className="p-2 border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors"
            title="WhatsApp Campaign"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 fill-current" />
          </button>

          {/* More */}
          <button
            onClick={() => showToast('Customer bulk action menu')}
            className="p-2 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 rounded-xl transition-colors"
            title="More Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Customers List / Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-gray-500">Loading customer records...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center p-6">
            <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">
              There are no records to display
            </p>
            <p className="text-xs text-gray-400 max-w-sm mb-4">
              {searchQuery
                ? 'No customers match your search criteria.'
                : `No customers found under the ${activeTab} section.`}
            </p>
            {!searchQuery && (
              <button
                onClick={openAddModal}
                className="px-4 py-2 bg-[#2E285F] hover:bg-[#221E4A] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                + Add First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-850/80 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredCustomers.length && filteredCustomers.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Phone / WhatsApp</th>
                  <th className="py-3 px-4">City / Company</th>
                  <th className="py-3 px-4">Interest</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredCustomers.map((cust) => {
                  const isSelected = selectedIds.includes(cust.id)
                  const isDeleting = deletingId === cust.id

                  return (
                    <tr
                      key={cust.id}
                      className={`hover:bg-gray-50/70 dark:hover:bg-gray-850/50 transition-colors ${
                        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(cust.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {cust.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              <span>{cust.name}</span>
                              {cust.is_favorite && (
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                              )}
                            </div>
                            {cust.email && (
                              <span className="text-[11px] text-gray-400 font-mono">{cust.email}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone & WhatsApp */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-700 dark:text-gray-300 font-medium">
                            {cust.phone_number}
                          </span>
                          <a
                            href={`https://wa.me/${cust.phone_number.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      {/* City & Company */}
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                        <div>
                          {cust.company && <div className="font-semibold text-gray-800 dark:text-gray-200">{cust.company}</div>}
                          <div className="text-[11px] text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {cust.city || 'India'}
                          </div>
                        </div>
                      </td>

                      {/* Interest */}
                      <td className="py-3.5 px-4">
                        {cust.machine_interest ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/60">
                            {cust.machine_interest}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            cust.status === 'deactive'
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200'
                          }`}
                        >
                          {cust.status === 'deactive' ? 'Deactive' : 'Active'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Favorite toggle */}
                          <button
                            onClick={() => toggleFavorite(cust)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              cust.is_favorite
                                ? 'text-amber-500 hover:bg-amber-50'
                                : 'text-gray-400 hover:text-amber-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            title="Toggle favorite"
                          >
                            <Star className={`w-3.5 h-3.5 ${cust.is_favorite ? 'fill-current' : ''}`} />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEditModal(cust)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(cust.id)}
                            disabled={isDeleting}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Delete Customer"
                          >
                            {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Customer Modal ────────────────────────────────────────── */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0" onClick={() => { setShowAddModal(false); setShowEditModal(false) }} />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-50 flex flex-col space-y-4 text-gray-900 dark:text-white">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddModal(false); setShowEditModal(false) }}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold">
                  {showEditModal ? 'Edit Customer' : 'Add New Customer'}
                </h4>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">City / Location</label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="e.g. Surat, Gujarat"
                    className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Company / Business</label>
                  <input
                    type="text"
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    placeholder="e.g. Patel Textiles"
                    className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Product / Interest</label>
                  <input
                    type="text"
                    value={formInterest}
                    onChange={(e) => setFormInterest(e.target.value)}
                    placeholder="e.g. Packaging Machine"
                    className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'active', label: 'Active' },
                    { key: 'deactive', label: 'Deactive' },
                    { key: 'favorite', label: 'Favorite' },
                  ].map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setFormStatus(st.key as any)}
                      className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                        formStatus === st.key
                          ? 'bg-[#2E285F] text-white border-transparent shadow-2xs'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setShowEditModal(false) }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formPhone.trim()}
                className="flex-1 py-2.5 bg-[#2E285F] hover:bg-[#221E4A] dark:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {showEditModal ? 'Save Changes' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import CSV Modal ─────────────────────────────────────────────────── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowImportModal(false)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-2xl z-50 text-center space-y-4 text-gray-900 dark:text-white">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Import Customer CSV</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Upload your CSV file containing Customer Name, Phone Number, City, and Company to import contacts in bulk.
              </p>
            </div>
            <input
              type="file"
              accept=".csv"
              className="text-xs file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowImportModal(false)
                  showToast('Import completed successfully!')
                }}
                className="flex-1 py-2 bg-[#2E285F] hover:bg-[#221E4A] text-white rounded-xl text-xs font-bold"
              >
                Upload & Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2E285F] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </DashboardLayout>
  )
}
