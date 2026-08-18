'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import {
  Plus, Search, Trash2, Edit2, Download, Upload, Filter,
  FileText, Calendar, X, Check, RefreshCw, Eye, MessageCircle,
  Printer, DollarSign, AlertCircle, ChevronDown, CheckCircle2, Percent
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

const GST_PRESETS = [0, 5, 12, 18, 28]

export default function InvoicePage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showReports, setShowReports] = useState(false)

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

  // Direct Editable Tax Rate
  const [taxRate, setTaxRate] = useState<number | string>(18)
  const [discount, setDiscount] = useState<number | string>(0)
  const [invStatus, setInvStatus] = useState<'paid' | 'unpaid' | 'partially_paid' | 'draft'>('unpaid')
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
  const numericTaxRate = useMemo(() => Number(taxRate) || 0, [taxRate])
  const numericDiscount = useMemo(() => Number(discount) || 0, [discount])
  const taxAmount = useMemo(() => (subtotal * numericTaxRate) / 100, [subtotal, numericTaxRate])
  const totalAmount = useMemo(() => Math.max(0, subtotal + taxAmount - numericDiscount), [subtotal, taxAmount, numericDiscount])

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
          tax_rate: numericTaxRate,
          tax_amount: taxAmount,
          discount: numericDiscount,
          total_amount: totalAmount,
          paid_amount: 0,
          status: invStatus,
          items,
          is_quotation: false,
        }),
      })

      if (res.ok) {
        showToast('Invoice created successfully!')
        setShowCreateModal(false)
        setCustName('')
        setCustPhone('')
        setCustEmail('')
        fetchInvoices()
      } else {
        alert('Failed to save invoice')
      }
    } catch (err) {
      console.error(err)
      alert('Error saving invoice')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this invoice permanently?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/invoices?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setInvoices((prev) => prev.filter((i) => i.id !== id))
        showToast('Invoice deleted')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  // Filtered List
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status.toUpperCase() !== statusFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const numMatch = inv.invoice_number?.toLowerCase().includes(q)
        const nameMatch = inv.customer_name?.toLowerCase().includes(q)
        const phoneMatch = inv.customer_phone?.toLowerCase().includes(q)
        if (!numMatch && !nameMatch && !phoneMatch) return false
      }
      return true
    })
  }, [invoices, statusFilter, searchQuery])

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Toast Notification */}
        {toastMsg && (
          <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Top Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Invoices & Billing
            </h1>
            <p className="text-xs text-gray-500 font-medium">Manage and generate GST invoices</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/invoice/add"
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-900 to-indigo-800 hover:from-blue-950 hover:to-indigo-900 text-white rounded-xl text-xs font-bold shadow-md hover:shadow transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Invoice</span>
            </Link>
            <button
              onClick={() => fetchInvoices()}
              className="p-2 border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 rounded-xl text-gray-600 dark:text-gray-400"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search invoice #, customer name, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-4 py-1.5 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56 sm:w-72"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {['ALL', 'PAID', 'UNPAID', 'PARTIALLY_PAID', 'DRAFT'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  statusFilter === st
                    ? 'bg-blue-900 text-white'
                    : 'bg-gray-100 dark:bg-gray-850 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices List Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          {loading && invoices.length === 0 ? (
            <div className="py-20 flex justify-center items-center">
              <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-xs">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No invoices found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-850 text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">GST Rate</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredInvoices.map((inv) => {
                    const statusObj = STATUS_CONFIG[inv.status] || STATUS_CONFIG.unpaid
                    const isDeleting = deletingId === inv.id

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-850/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {inv.invoice_number}
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-gray-900 dark:text-white">{inv.customer_name}</p>
                          {inv.customer_phone && (
                            <p className="text-[10px] text-gray-400 font-mono">{inv.customer_phone}</p>
                          )}
                        </td>
                        <td className="p-3 text-gray-500">{inv.issue_date}</td>
                        <td className="p-3 text-gray-500">{inv.due_date}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                            {inv.tax_rate ?? 18}%
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                          ₹{Number(inv.total_amount).toLocaleString()}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusObj.style}`}>
                            {statusObj.label}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedInvoice(inv)
                                setShowViewModal(true)
                              }}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg"
                              title="View & Print"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(inv.id)}
                              disabled={isDeleting}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* ── View / Print Invoice Modal ─────────────────────────────────────── */}
        {showViewModal && selectedInvoice && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
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
                </div>
                <div className="text-right">
                  <p className="text-gray-400 font-bold uppercase text-[10px]">Dates & Tax:</p>
                  <p className="text-gray-600 dark:text-gray-300">Issue: {selectedInvoice.issue_date}</p>
                  <p className="text-gray-600 dark:text-gray-300 font-bold text-indigo-600">GST: {selectedInvoice.tax_rate ?? 18}%</p>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-950 rounded-xl font-bold text-sm">
                <span>Total Payable:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono text-base">
                  ₹{Number(selectedInvoice.total_amount).toLocaleString()}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                {selectedInvoice.customer_phone && (
                  <a
                    href={`https://wa.me/${selectedInvoice.customer_phone.replace(/\D/g, '')}?text=Dear%20${encodeURIComponent(selectedInvoice.customer_name)},%20your%20invoice%20${selectedInvoice.invoice_number}%20for%20Rs.${selectedInvoice.total_amount}%20is%20ready.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
