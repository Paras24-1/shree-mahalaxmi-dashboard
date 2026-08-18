'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  CreditCard,
  QrCode,
  Building,
  Banknote,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Save,
  X,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ExternalLink,
} from 'lucide-react'

interface BankDetails {
  accountName: string
  bankName: string
  accountNumber: string
  ifscCode: string
  branch: string
  isActive: boolean
}

interface UpiDetails {
  upiId: string
  payeeName: string
  merchantCode: string
  isActive: boolean
}

interface PaymentRecord {
  id: string
  customerName: string
  invoiceNumber: string
  amount: number
  method: 'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Gateway'
  date: string
  utrNumber: string
  status: 'completed' | 'pending' | 'failed'
}

export default function PaymentMethodsPage() {
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Bank Form State
  const [bank, setBank] = useState<BankDetails>(() => {
    return {
      accountName: 'Shree Mahalaxmi Enterprises',
      bankName: 'HDFC Bank Ltd.',
      accountNumber: '50200012345678',
      ifscCode: 'HDFC0001234',
      branch: 'Industrial Area Phase 2, Pune',
      isActive: true,
    }
  })
  const [editingBank, setEditingBank] = useState(false)

  // UPI Form State
  const [upi, setUpi] = useState<UpiDetails>(() => {
    return {
      upiId: 'shreemahalaxmi@hdfcbank',
      payeeName: 'Shree Mahalaxmi Enterprises',
      merchantCode: 'SME789456',
      isActive: true,
    }
  })
  const [editingUpi, setEditingUpi] = useState(false)

  // Gateway Settings State
  const [gatewayKey, setGatewayKey] = useState('rzp_live_9x8A7b6C5d4E3f2')
  const [gatewaySecret, setGatewaySecret] = useState('••••••••••••••••••••••••')
  const [gatewayMode, setGatewayMode] = useState<'live' | 'test'>('live')
  const [editingGateway, setEditingGateway] = useState(false)

  // Recorded Payments List
  const [payments, setPayments] = useState<PaymentRecord[]>([
    {
      id: 'PAY-1001',
      customerName: 'Ramesh Patel',
      invoiceNumber: 'INV-402911',
      amount: 45000,
      method: 'UPI',
      date: new Date().toISOString().split('T')[0],
      utrNumber: 'UPI/429810291823',
      status: 'completed',
    },
    {
      id: 'PAY-1002',
      customerName: 'Anil Sharma - Sunrise Packaging',
      invoiceNumber: 'INV-398102',
      amount: 118000,
      method: 'Bank Transfer',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      utrNumber: 'NEFT/HDFC9821039',
      status: 'completed',
    },
    {
      id: 'PAY-1003',
      customerName: 'Kunal Verma',
      invoiceNumber: 'INV-389104',
      amount: 25000,
      method: 'Cheque',
      date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
      utrNumber: 'CHQ-849201',
      status: 'pending',
    },
  ])

  // Record Payment Modal
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [newCustName, setNewCustName] = useState('')
  const [newInvNum, setNewInvNum] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newMethod, setNewMethod] = useState<'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Gateway'>('UPI')
  const [newUtr, setNewUtr] = useState('')
  const [savingPayment, setSavingPayment] = useState(false)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
    showToast('Copied to clipboard!')
  }

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustName.trim() || !newAmount) return
    setSavingPayment(true)

    const newRec: PaymentRecord = {
      id: `PAY-${Date.now().toString().slice(-4)}`,
      customerName: newCustName.trim(),
      invoiceNumber: newInvNum.trim() || `INV-${Date.now().toString().slice(-6)}`,
      amount: Number(newAmount),
      method: newMethod,
      date: new Date().toISOString().split('T')[0],
      utrNumber: newUtr.trim() || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'completed',
    }

    setPayments([newRec, ...payments])
    setSavingPayment(false)
    setShowRecordModal(false)
    setNewCustName('')
    setNewInvNum('')
    setNewAmount('')
    setNewUtr('')
    showToast('Payment recorded successfully!')
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Toast */}
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
              Payment Methods & Gateway
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Manage bank settlement accounts, UPI QR IDs, and customer payment logs
            </p>
          </div>

          <button
            onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-900 to-indigo-800 hover:from-blue-950 hover:to-indigo-900 text-white rounded-xl text-xs font-bold shadow-md hover:shadow transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
        </div>

        {/* Section 1: Active Payment Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Bank Account Details */}
          <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-4 relative flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Building className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Active
                  </span>
                  <button
                    onClick={() => setEditingBank((v) => !v)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg"
                    title="Edit Bank Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Bank Account (NEFT / RTGS)</h3>
                <p className="text-xs text-gray-500 font-medium">Direct Settlement & Wire Transfers</p>
              </div>

              {!editingBank ? (
                <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-850/60 p-3.5 rounded-xl">
                  <p className="font-semibold text-gray-900 dark:text-white">{bank.bankName}</p>
                  <p className="font-mono flex items-center justify-between">
                    <span>A/C: {bank.accountNumber}</span>
                    <button
                      onClick={() => copyToClipboard(bank.accountNumber, 'ac')}
                      className="text-gray-400 hover:text-indigo-600"
                    >
                      {copiedKey === 'ac' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </p>
                  <p className="font-mono flex items-center justify-between">
                    <span>IFSC: {bank.ifscCode}</span>
                    <button
                      onClick={() => copyToClipboard(bank.ifscCode, 'ifsc')}
                      className="text-gray-400 hover:text-indigo-600"
                    >
                      {copiedKey === 'ifsc' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">{bank.branch}</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <input
                    type="text"
                    placeholder="Bank Name"
                    value={bank.bankName}
                    onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={bank.accountNumber}
                    onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 font-mono"
                  />
                  <input
                    type="text"
                    placeholder="IFSC Code"
                    value={bank.ifscCode}
                    onChange={(e) => setBank({ ...bank, ifscCode: e.target.value })}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 font-mono"
                  />
                  <button
                    onClick={() => {
                      setEditingBank(false)
                      showToast('Bank details updated successfully!')
                    }}
                    className="w-full py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-xs"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 flex justify-between">
              <span>Account Holder:</span>
              <span className="font-bold text-gray-700 dark:text-gray-300">{bank.accountName}</span>
            </div>
          </div>

          {/* Card 2: UPI / QR Code */}
          <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-4 relative flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Active
                  </span>
                  <button
                    onClick={() => setEditingUpi((v) => !v)}
                    className="p-1.5 text-gray-400 hover:text-emerald-600 rounded-lg"
                    title="Edit UPI ID"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Instant UPI & QR Code</h3>
                <p className="text-xs text-gray-500 font-medium">GPay, PhonePe, Paytm, BHIM</p>
              </div>

              {!editingUpi ? (
                <div className="space-y-2 text-xs bg-gray-50 dark:bg-gray-850/60 p-3.5 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">VPA / UPI ID:</p>
                      <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{upi.upiId}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(upi.upiId, 'upi')}
                      className="p-1.5 text-gray-400 hover:text-emerald-600"
                    >
                      {copiedKey === 'upi' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">Merchant Code: {upi.merchantCode}</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <input
                    type="text"
                    placeholder="UPI ID (e.g. business@bank)"
                    value={upi.upiId}
                    onChange={(e) => setUpi({ ...upi, upiId: e.target.value })}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 font-mono font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Merchant Code"
                    value={upi.merchantCode}
                    onChange={(e) => setUpi({ ...upi, merchantCode: e.target.value })}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950"
                  />
                  <button
                    onClick={() => {
                      setEditingUpi(false)
                      showToast('UPI details updated!')
                    }}
                    className="w-full py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs"
                  >
                    Save Changes
                  </button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 flex justify-between">
              <span>Payee Name:</span>
              <span className="font-bold text-gray-700 dark:text-gray-300">{upi.payeeName}</span>
            </div>
          </div>

          {/* Card 3: Online Gateway Settings */}
          <div className="p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-4 relative flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 uppercase">
                    {gatewayMode}
                  </span>
                  <button
                    onClick={() => setEditingGateway((v) => !v)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg"
                    title="Configure Gateway"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Payment Gateway (Cards / NetBanking)</h3>
                <p className="text-xs text-gray-500 font-medium">Razorpay / Cashfree Automated Invoicing</p>
              </div>

              {!editingGateway ? (
                <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-850/60 p-3.5 rounded-xl font-mono">
                  <p className="text-[10px] text-gray-400 uppercase font-bold font-sans">API Key ID:</p>
                  <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{gatewayKey}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-bold font-sans mt-2">Webhook URL:</p>
                  <p className="text-[11px] text-blue-600 truncate">https://api.mahalaxmi.com/webhook/pay</p>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  <input
                    type="text"
                    placeholder="Razorpay Key ID"
                    value={gatewayKey}
                    onChange={(e) => setGatewayKey(e.target.value)}
                    className="w-full p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-950 font-mono"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setGatewayMode('live')}
                      className={`flex-1 py-1 text-xs rounded-lg font-bold ${
                        gatewayMode === 'live' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Live
                    </button>
                    <button
                      onClick={() => setGatewayMode('test')}
                      className={`flex-1 py-1 text-xs rounded-lg font-bold ${
                        gatewayMode === 'test' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      Test
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setEditingGateway(false)
                      showToast('Gateway configuration saved!')
                    }}
                    className="w-full py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs"
                  >
                    Save Gateway
                  </button>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>256-bit Encrypted Settlement</span>
            </div>
          </div>
        </div>

        {/* Section 2: Recorded Payments History Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden space-y-3 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white">Recent Payment Receipts</h3>
              <p className="text-xs text-gray-500">Live ledger of collected customer payments</p>
            </div>
            <span className="text-xs font-bold text-gray-500 font-mono">{payments.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-850 text-gray-600 dark:text-gray-400 font-bold border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="p-3">Receipt ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Reference / UTR</th>
                  <th className="p-3 text-right">Amount Received</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-850/50 transition-colors">
                    <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{p.id}</td>
                    <td className="p-3 font-bold text-gray-900 dark:text-white">{p.customerName}</td>
                    <td className="p-3 font-mono text-gray-500">{p.invoiceNumber}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-[10px]">
                        {p.method}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500 font-mono">{p.date}</td>
                    <td className="p-3 font-mono text-[11px] text-gray-400">{p.utrNumber}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ₹{p.amount.toLocaleString()}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Record Payment Modal ────────────────────────────────────────── */}
        {showRecordModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-2xl z-50 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Record Customer Payment</h3>
                <button onClick={() => setShowRecordModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Patel"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Invoice #</label>
                    <input
                      type="text"
                      placeholder="e.g. INV-402911"
                      value={newInvNum}
                      onChange={(e) => setNewInvNum(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="45000"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 font-mono font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                    <select
                      value={newMethod}
                      onChange={(e) => setNewMethod(e.target.value as any)}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 font-semibold outline-none"
                    >
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Gateway">Online Gateway</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Reference / UTR #</label>
                    <input
                      type="text"
                      placeholder="e.g. UPI/429810291"
                      value={newUtr}
                      onChange={(e) => setNewUtr(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowRecordModal(false)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayment}
                    className="flex-1 py-2.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5"
                  >
                    {savingPayment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Record Payment</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
