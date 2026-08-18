'use client'

import React, { useState, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Printer,
  MessageCircle,
  FileText,
  DollarSign,
  CheckCircle2,
  RefreshCw,
  Building,
  User,
  Phone,
  Mail,
  Calendar,
} from 'lucide-react'

interface InvoiceItem {
  name: string
  qty: number
  rate: number
  amount: number
}

export default function InvoiceAddPage() {
  const router = useRouter()

  // Form State
  const [invNumber, setInvNumber] = useState(() => `INV-${Date.now().toString().slice(-6)}`)
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [custEmail, setCustEmail] = useState('')
  const [custAddress, setCustAddress] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 15)
    return d.toISOString().split('T')[0]
  })
  const [status, setStatus] = useState<'paid' | 'unpaid' | 'partially_paid' | 'draft'>('unpaid')
  const [notes, setNotes] = useState('Thank you for doing business with Shree Mahalaxmi Enterprises!')

  // Line items
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: 'Industrial Packaging Machine - Model A', qty: 1, rate: 45000, amount: 45000 },
  ])
  const [taxRate, setTaxRate] = useState(18)
  const [discount, setDiscount] = useState(0)
  const [paidAmount, setPaidAmount] = useState(0)

  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)

  // Handlers
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

  const handleSave = async (andRedirect: boolean = true) => {
    if (!custName.trim()) {
      alert('Please enter the Customer Name')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_number: invNumber,
          customer_name: custName.trim(),
          customer_phone: custPhone.trim() || null,
          customer_email: custEmail.trim() || null,
          issue_date: issueDate,
          due_date: dueDate,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          discount,
          total_amount: totalAmount,
          paid_amount: paidAmount,
          status,
          items,
          notes: notes.trim() || null,
          is_quotation: false,
        }),
      })

      if (res.ok) {
        setSavedSuccess(true)
        if (andRedirect) {
          setTimeout(() => router.push('/invoice'), 500)
        }
      } else {
        alert('Failed to save invoice. Please check all fields.')
      }
    } catch (err) {
      console.error('Error creating invoice:', err)
      alert('Error creating invoice')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Header Breadcrumb & Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/invoice"
              className="p-2 border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Create New Invoice
              </h1>
              <p className="text-xs text-gray-500 font-medium">Generate tax invoice and share with client</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/invoice"
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-850"
            >
              Cancel
            </Link>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-900 to-indigo-800 hover:from-blue-950 hover:to-indigo-900 text-white rounded-xl text-xs font-bold shadow-md hover:shadow transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? 'Creating...' : 'Save & Publish Invoice'}</span>
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Invoice {invNumber} created successfully! Redirecting...</span>
          </div>
        )}

        {/* Invoice Creation Paper Layout */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-8">
          {/* Section 1: Business Identity & Invoice Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-100 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="px-2 py-0.5 bg-blue-900 text-white font-extrabold rounded text-xs">SHREE</div>
                <span className="font-bold text-gray-900 dark:text-white text-base">Mahalaxmi Enterprises</span>
              </div>
              <p className="text-xs text-gray-500">Plot No. 42, Industrial Area, Phase II</p>
              <p className="text-xs text-gray-500">GSTIN: 27AABCS1429B1Z8</p>
              <p className="text-xs text-gray-500">Contact: +91 98230 12345 | info@mahalaxmi.com</p>
            </div>

            <div className="space-y-3 md:text-right">
              <div className="flex items-center md:justify-end gap-2">
                <label className="text-xs font-bold text-gray-500">Invoice No:</label>
                <input
                  type="text"
                  value={invNumber}
                  onChange={(e) => setInvNumber(e.target.value)}
                  className="px-3 py-1 text-xs font-mono font-bold border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none w-36 text-center"
                />
              </div>

              <div className="flex items-center md:justify-end gap-2">
                <label className="text-xs font-bold text-gray-500">Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="px-3 py-1 text-xs font-semibold border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 outline-none w-36"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div className="flex items-center md:justify-end gap-2">
                <label className="text-xs font-bold text-gray-500">Issue Date:</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="px-3 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 outline-none w-36"
                />
              </div>

              <div className="flex items-center md:justify-end gap-2">
                <label className="text-xs font-bold text-gray-500">Due Date:</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="px-3 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 outline-none w-36"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Bill To Customer Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-400">
              Bill To Customer
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Customer / Company Name *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="client@company.com"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Line Items Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-400">
                Items & Services
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-850 text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">Item / Service Description</th>
                    <th className="p-3 w-24 text-right">Qty</th>
                    <th className="p-3 w-32 text-right">Rate (₹)</th>
                    <th className="p-3 w-36 text-right">Amount (₹)</th>
                    <th className="p-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50">
                      <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          required
                          placeholder="Item name or description"
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                          className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none text-right font-mono font-bold"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          min="0"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none text-right font-mono font-bold"
                        />
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                        ₹{(item.amount || 0).toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          disabled={items.length <= 1}
                          className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Totals & Tax Calculation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Terms & Client Notes
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Payment terms, bank account details, or instructions..."
                className="w-full p-3 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white outline-none resize-none"
              />
            </div>

            <div className="bg-gray-50 dark:bg-gray-850/60 p-4 rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal:</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  ₹{subtotal.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  Tax / GST Rate:
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="ml-1 px-1.5 py-0.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 font-bold"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  ₹{taxAmount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                <span>Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-24 px-2 py-1 text-right font-mono border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm font-black text-blue-950 dark:text-white">
                <span>Grand Total:</span>
                <span className="font-mono text-base text-indigo-600 dark:text-indigo-400">
                  ₹{totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-900 to-indigo-800 hover:from-blue-950 hover:to-indigo-900 text-white rounded-xl text-xs font-bold shadow-md hover:shadow transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save & Publish Invoice</span>
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
