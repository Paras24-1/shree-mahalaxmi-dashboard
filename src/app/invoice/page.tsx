'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import {
  Plus, Search, Trash2, Edit2, Download, Upload, Filter,
  FileText, Calendar, X, Check, RefreshCw, Eye, MessageCircle,
  Printer, DollarSign, AlertCircle, ChevronDown, CheckCircle2
} from 'lucide-react'

interface InvoiceItem {
  name: string
  qty: number
  rate: number
  amount: number
}

interface Invoice {
  id: string
  invoice_number: string
  customer_name: string
  customer_phone?: string
  customer_email?: string
  issue_date: string
  due_date: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  discount: number
  total_amount: number
  paid_amount: number
  status: 'paid' | 'unpaid' | 'partially_paid' | 'overdue' | 'draft'
  items?: InvoiceItem[]
  notes?: string
  is_quotation?: boolean
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  paid: { label: 'Paid', style: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200' },
  unpaid: { label: 'Unpaid', style: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200' },
  partially_paid: { label: 'Partially Paid', style: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200' },
  overdue: { label: 'Overdue', style: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-300 font-bold' },
  draft: { label: 'Draft', style: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200' },
}

export default function InvoicePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showReports, setShowReports] = useState(false)

  // Date Filter Range
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0])

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)

  // Form states
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [invIssueDate, setInvIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [invDueDate, setInvDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().split('T')[0]
  })
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: 'Industrial Packaging Machine Model A', qty: 1, rate: 45000, amount: 45000 }
  ])
  const [taxRate, setTaxRate] = useState(18)
  const [discount, setDiscount] = useState(0)
  const [invStatus, setInvStatus] = useState<'paid' | 'unpaid' | 'partially_paid' | 'draft'>('unpaid')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // ── Fetch Invoices ─────────────────────────────────────────────────────────

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invoices?is_quotation=false')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Invoice[] = await res.json()
      setInvoices(data)
    } catch (err) {
      console.error('Error fetching invoices:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // ── Item calculation ───────────────────────────────────────────────────────

  const handleItemChange = (index: number, field: keyof InvoiceItem, val: any) => {
    const next = [...items]
    next[index] = { ...next[index], [field]: val }
    if (field === 'qty' || field === 'rate') {
      next[index].amount = Number(next[index].qty || 0) * Number(next[index].rate || 0)
    }
    setItems(next)
  }

  const addItemRow = () => {
    setItems([...items, { name: '', qty: 1, rate: 0, amount: 0 }])
  }

  const removeItemRow = (idx: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx))
    }
  }

  const subtotal = useMemo(() => items.reduce((acc, it) => acc + (it.amount || 0), 0), [items])
  const taxAmount = useMemo(() => (subtotal * taxRate) / 100, [subtotal, taxRate])
  const totalAmount = useMemo(() => Math.max(0, subtotal + taxAmount - discount), [subtotal, taxAmount, discount])

  // ── Create Invoice ─────────────────────────────────────────────────────────

  const handleSaveInvoice = async () => {
    if (!custName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: custName.trim(),
          customer_phone: custPhone.trim() || null,
          customer_email: custEmail.trim() || null,
          issue_date: invIssueDate,
          due_date: invDueDate,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          discount,
          total_amount: totalAmount,
          paid_amount: invStatus === 'paid' ? totalAmount : 0,
          status: invStatus,
          items,
          notes: notes.trim() || null,
          is_quotation: false,
        }),
      })

      if (!res.ok) throw new Error('Failed to create invoice')
      setShowCreateModal(false)
      showToast('Invoice created successfully')
      await fetchInvoices()
    } catch (err) {
      console.error('Error creating invoice:', err)
      alert('Failed to create invoice.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this invoice?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/invoices?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setInvoices(prev => prev.filter(i => i.id !== id))
      showToast('Invoice deleted')
    } catch (err) {
      console.error('Error deleting invoice:', err)
      alert('Failed to delete invoice.')
    } finally {
      setDeletingId(null)
    }
  }

  // ── CSV Export ─────────────────────────────────────────────────────────────

  const handleExportCSV = () => {
    if (invoices.length === 0) {
      alert('No invoice records to export.')
      return
    }
    const headers = ['Invoice No', 'Customer Name', 'Phone', 'Issue Date', 'Due Date', 'Total Amount', 'Status']
    const rows = invoices.map(i => [
      `"${i.invoice_number}"`,
      `"${i.customer_name}"`,
      `"${i.customer_phone || ''}"`,
      `"${i.issue_date}"`,
      `"${i.due_date}"`,
      `"${i.total_amount}"`,
      `"${i.status}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `invoices_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Invoices exported as CSV')
  }

  // ── Filtered Data ──────────────────────────────────────────────────────────

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (statusFilter !== 'ALL' && inv.status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNum = inv.invoice_number.toLowerCase().includes(q)
        const matchName = inv.customer_name.toLowerCase().includes(q)
        const matchPhone = (inv.customer_phone || '').toLowerCase().includes(q)
        return matchNum || matchName || matchPhone
      }
      return true
    })
  }, [invoices, statusFilter, searchQuery])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Invoice</h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search invoices..."
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

          {/* Reports Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowReports(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span>Reports</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {showReports && (
              <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-3 z-30 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total Invoices:</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{invoices.length}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">Total Revenue:</span>
                  <span className="font-bold text-emerald-600">
                    ₹{invoices.reduce((a, b) => a + Number(b.total_amount || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Unpaid Total:</span>
                  <span className="font-bold text-red-600">
                    ₹{invoices.filter(i => i.status !== 'paid').reduce((a, b) => a + Number(b.total_amount || 0), 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Export button */}
          <button
            onClick={handleExportCSV}
            className="p-2 border border-gray-200 dark:border-gray-800 bg-[#2E285F] text-white hover:bg-[#201c44] rounded-xl transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Import button */}
          <button
            onClick={() => showToast('Invoice import template ready')}
            className="p-2 border border-gray-200 dark:border-gray-800 bg-[#2E285F] text-white hover:bg-[#201c44] rounded-xl transition-colors"
            title="Import Invoices"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Filter Dropdown */}
          <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors shadow-sm">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <span>Filter</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Second Row: Create Invoice + Date Range + Status Dropdown */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#2E285F] hover:bg-[#201c44] text-white text-xs font-bold rounded-xl shadow-md transition-all self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Create Invoice</span>
        </button>

        <div className="flex items-center gap-4 flex-wrap self-end md:self-auto">
          {/* Date Range Display / Selector */}
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 px-3.5 py-2 rounded-xl shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-gray-500" />
            <span>01-08-2026 To 18-08-2026</span>
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-2 pr-8 text-xs font-bold text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="ALL">ALL</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="draft">Draft</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Main Invoices Table Container */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 m-auto">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-gray-500">Loading invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 m-auto text-center p-6">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              There are no records to display
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Click &quot;Create Invoice&quot; to generate your first tax invoice with itemized pricing and GST.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-[#2E285F] hover:bg-[#201c44] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
            >
              + Create Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-850/80 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Issue Date</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-right">Total Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredInvoices.map((inv) => {
                  const statusConf = STATUS_CONFIG[inv.status] || STATUS_CONFIG.unpaid
                  const isDeleting = deletingId === inv.id

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-850/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700 dark:text-indigo-400">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-gray-900 dark:text-white">{inv.customer_name}</div>
                        {inv.customer_phone && <div className="text-[11px] text-gray-400 font-mono">{inv.customer_phone}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                        {new Date(inv.issue_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                        {new Date(inv.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-gray-900 dark:text-white font-mono">
                        ₹{Number(inv.total_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusConf.style}`}>
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp */}
                          {inv.customer_phone && (
                            <a
                              href={`https://wa.me/${inv.customer_phone.replace(/\D/g, '')}?text=Dear%20${encodeURIComponent(inv.customer_name)},%20here%20is%20your%20invoice%20${inv.invoice_number}%20for%20Rs.${inv.total_amount}.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Share on WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          {/* View */}
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv)
                              setShowViewModal(true)
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                            title="View Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(inv.id)}
                            disabled={isDeleting}
                            className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Delete Invoice"
                          >
                            {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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

      {/* ── Create Invoice Modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-2xl z-50 max-h-[90vh] overflow-y-auto space-y-4 text-gray-900 dark:text-white">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold">Create New Invoice</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Email</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  placeholder="name@business.com"
                  className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Dates & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Issue Date</label>
                <input
                  type="date"
                  value={invIssueDate}
                  onChange={(e) => setInvIssueDate(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Due Date</label>
                <input
                  type="date"
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Status</label>
                <select
                  value={invStatus}
                  onChange={(e) => setInvStatus(e.target.value as any)}
                  className="w-full text-xs p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 outline-none font-semibold"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Item Details</label>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Item / Machine name"
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      className="flex-3 text-xs p-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950"
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={item.qty}
                      onChange={(e) => handleItemChange(idx, 'qty', Number(e.target.value))}
                      className="w-16 text-xs p-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-center font-mono"
                    />
                    <input
                      type="number"
                      placeholder="Rate (₹)"
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', Number(e.target.value))}
                      className="w-24 text-xs p-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-right font-mono"
                    />
                    <div className="w-24 text-xs p-2 font-mono font-bold text-right">
                      ₹{Number(item.amount || 0).toLocaleString('en-IN')}
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Summary */}
            <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal:</span>
                <span className="font-mono">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>GST (18%):</span>
                <span className="font-mono">₹{taxAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-gray-800">
                <span>Total Amount:</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveInvoice}
                disabled={saving || !custName.trim()}
                className="flex-1 py-2.5 bg-[#2E285F] hover:bg-[#201c44] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Generate Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Invoice Modal (Printable) ───────────────────────────────────── */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowViewModal(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-2xl z-50 text-gray-900 dark:text-white space-y-4">
            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-indigo-900 dark:text-indigo-400">INVOICE</h3>
                <p className="text-xs text-gray-500 font-mono">{selectedInvoice.invoice_number}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-gray-400 font-bold uppercase text-[10px]">Billed To:</p>
                <p className="font-bold text-gray-800 dark:text-gray-200">{selectedInvoice.customer_name}</p>
                {selectedInvoice.customer_phone && <p className="text-gray-500 font-mono">{selectedInvoice.customer_phone}</p>}
                {selectedInvoice.customer_email && <p className="text-gray-500">{selectedInvoice.customer_email}</p>}
              </div>
              <div className="text-right">
                <p className="text-gray-400 font-bold uppercase text-[10px]">Dates:</p>
                <p className="text-gray-600 dark:text-gray-300">Issue: {selectedInvoice.issue_date}</p>
                <p className="text-gray-600 dark:text-gray-300">Due: {selectedInvoice.due_date}</p>
              </div>
            </div>

            {/* Line items table */}
            <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-[10px] uppercase font-bold text-gray-500">
                  <tr>
                    <th className="p-2">Item</th>
                    <th className="p-2 text-center">Qty</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
                  {(selectedInvoice.items && selectedInvoice.items.length > 0 ? selectedInvoice.items : [
                    { name: 'Machinery Equipment Order', qty: 1, rate: selectedInvoice.total_amount, amount: selectedInvoice.total_amount }
                  ]).map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-sans font-medium">{it.name}</td>
                      <td className="p-2 text-center">{it.qty}</td>
                      <td className="p-2 text-right">₹{Number(it.rate).toLocaleString('en-IN')}</td>
                      <td className="p-2 text-right font-bold">₹{Number(it.amount).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-950 rounded-xl font-bold text-sm">
              <span>Total Payable:</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-mono text-base">₹{Number(selectedInvoice.total_amount).toLocaleString('en-IN')}</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
              {selectedInvoice.customer_phone && (
                <a
                  href={`https://wa.me/${selectedInvoice.customer_phone.replace(/\D/g, '')}?text=Dear%20${encodeURIComponent(selectedInvoice.customer_name)},%20here%20is%20your%20invoice%20${selectedInvoice.invoice_number}%20for%20Rs.${selectedInvoice.total_amount}.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Share on WhatsApp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2E285F] text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </DashboardLayout>
  )
}
