'use client'

import React, { useState } from 'react'
import {
  X,
  Coins,
  CheckCircle,
  Zap,
  CreditCard,
  QrCode,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Sparkles,
  PhoneCall,
  Clock
} from 'lucide-react'

interface CreditTopUpModalProps {
  isOpen: boolean
  onClose: () => void
  currentBalance: number
  onTopUpSuccess: (newBalance: number) => void
}

const PACKAGES = [
  {
    id: 'starter',
    name: 'Starter Pack',
    amount: 500,
    mins: '~140 mins',
    badge: 'Quick Test',
    color: 'border-gray-200 dark:border-gray-800 hover:border-violet-500',
    iconColor: 'text-violet-500',
    popular: false,
  },
  {
    id: 'growth',
    name: 'Growth Pack',
    amount: 1000,
    mins: '~300 mins',
    badge: 'Most Popular',
    color: 'border-violet-500 bg-violet-50/20 dark:bg-violet-950/20',
    iconColor: 'text-violet-600',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Scale Pro',
    amount: 2500,
    mins: '~800 mins',
    badge: 'Best Value',
    color: 'border-gray-200 dark:border-gray-800 hover:border-violet-500',
    iconColor: 'text-indigo-500',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise Bulk',
    amount: 5000,
    mins: '~1,800 mins',
    badge: 'High Volume',
    color: 'border-gray-200 dark:border-gray-800 hover:border-violet-500',
    iconColor: 'text-emerald-500',
    popular: false,
  },
]

export default function CreditTopUpModal({
  isOpen,
  onClose,
  currentBalance,
  onTopUpSuccess,
}: CreditTopUpModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(1000)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'instant' | 'upi' | 'whatsapp'>('instant')
  const [utrNumber, setUtrNumber] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [successData, setSuccessData] = useState<{ amount: number; newBalance: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const effectiveAmount = customAmount ? Number(customAmount) || 0 : selectedAmount
  const estimatedMins = Math.floor(effectiveAmount / 3.5)

  const handleSelectPackage = (amount: number) => {
    setSelectedAmount(amount)
    setCustomAmount('')
    setErrorMsg(null)
  }

  const handleCustomAmountChange = (val: string) => {
    const numeric = val.replace(/\D/g, '')
    setCustomAmount(numeric)
    if (numeric) {
      setSelectedAmount(Number(numeric))
    }
    setErrorMsg(null)
  }

  const handleExecuteTopUp = async () => {
    if (effectiveAmount < 100) {
      setErrorMsg('Minimum top-up amount is ₹100')
      return
    }

    setIsProcessing(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/voice/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          transaction_id: utrNumber.trim() || `TOPUP-${Date.now()}`,
          payment_method: activeTab === 'upi' ? `UPI (UTR: ${utrNumber})` : 'Direct Top-Up',
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSuccessData({
          amount: effectiveAmount,
          newBalance: data.new_balance,
        })
        onTopUpSuccess(data.new_balance)
      } else {
        setErrorMsg(data.error || 'Failed to process top-up. Please try again.')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error while processing top-up.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleResetAndClose = () => {
    setSuccessData(null)
    setErrorMsg(null)
    setUtrNumber('')
    setCustomAmount('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                Top Up Voice AI Credits
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                  INSTANT
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Recharge call minutes for automated inbound and outbound calls</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Current Balance Banner */}
          <div className="bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-purple-600/10 dark:from-violet-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border border-violet-200/60 dark:border-violet-800/40 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm">
                <Coins className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current AI Wallet Balance</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">
                    ₹{Number(currentBalance).toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    ~{Math.floor(currentBalance / 3.5)} mins remaining
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right text-[11px] text-gray-500 dark:text-gray-400 hidden sm:block">
              <p className="font-semibold text-violet-700 dark:text-violet-300">Rate: ₹3.50 / minute</p>
              <p className="text-[10px]">Billed per completed second</p>
            </div>
          </div>

          {successData ? (
            /* Success Confirmation Screen */
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-4 animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Credits Added Successfully!</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                  ₹{successData.amount.toLocaleString()} has been credited to your Voice AI wallet. Your new live balance is:
                </p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2 font-mono">
                  ₹{Number(successData.newBalance).toFixed(2)}
                </p>
                <p className="text-xs text-gray-400 mt-1 font-semibold">
                  (~{Math.floor(successData.newBalance / 3.5)} call minutes available)
                </p>
              </div>

              <div className="pt-4 flex gap-3 w-full max-w-xs">
                <button
                  onClick={handleResetAndClose}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Done & Close
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Select Package Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Select Top-Up Package
                  </label>
                  <span className="text-[11px] text-violet-600 dark:text-violet-400 font-semibold">
                    100% Secure & Instant
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PACKAGES.map((pkg) => {
                    const isSelected = selectedAmount === pkg.amount && !customAmount
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => handleSelectPackage(pkg.amount)}
                        className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                          isSelected
                            ? 'border-violet-600 bg-violet-50/30 dark:bg-violet-950/20 shadow-md ring-2 ring-violet-500/20'
                            : `${pkg.color} bg-white dark:bg-gray-950`
                        }`}
                      >
                        {pkg.popular && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-gradient-to-r from-violet-600 to-pink-600 text-white text-[9px] font-black rounded-full uppercase tracking-wider shadow-xs">
                            {pkg.badge}
                          </span>
                        )}
                        {!pkg.popular && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[9px] font-bold rounded-full uppercase tracking-wider">
                            {pkg.badge}
                          </span>
                        )}

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{pkg.name}</p>
                            <p className="text-xl font-black text-gray-900 dark:text-white font-mono mt-1">
                              ₹{pkg.amount.toLocaleString()}
                            </p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-violet-600 bg-violet-600 text-white' : 'border-gray-300 dark:border-gray-700'
                          }`}>
                            {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80 text-[11px] text-gray-500">
                          <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                            <Clock className="w-3 h-3 text-violet-500" /> {pkg.mins}
                          </span>
                          <span className="text-[10px] text-gray-400">₹3.50/min</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Custom Amount Option */}
              <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Or Enter Custom Amount (₹)</label>
                  {customAmount && (
                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                      ≈ {estimatedMins} call minutes
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-sm">₹</span>
                    <input
                      type="text"
                      placeholder="e.g. 1500, 3000, 10000"
                      value={customAmount}
                      onChange={(e) => handleCustomAmountChange(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 text-sm font-mono font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  {[500, 1000, 2000, 5000].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => handleCustomAmountChange(String(quick))}
                      className="px-2.5 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      +₹{quick}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Methods Tabs */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Payment Method
                </label>

                <div className="flex bg-gray-100 dark:bg-gray-850 p-1 rounded-2xl gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('instant')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'instant'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Instant Direct Top-Up</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('upi')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'upi'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                    <span>UPI QR / Bank</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('whatsapp')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'whatsapp'
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                    <span>WhatsApp / Billing</span>
                  </button>
                </div>

                {/* Tab 1: Instant Direct Top-Up */}
                {activeTab === 'instant' && (
                  <div className="bg-violet-50/40 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-bold text-gray-900 dark:text-white">Instant Credit Addition</p>
                        <p className="text-gray-500 dark:text-gray-400 mt-0.5">
                          Credits are immediately applied to your Voice AI caller engine and live database.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: UPI QR Code */}
                {activeTab === 'upi' && (
                  <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                      <div className="w-24 h-24 bg-white p-2 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center shrink-0">
                        <QrCode className="w-16 h-16 text-gray-800" />
                        <span className="text-[8px] font-black uppercase text-violet-600">Scan to Pay</span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <p className="font-bold text-gray-900 dark:text-white">UPI ID: <span className="font-mono text-violet-600 dark:text-violet-400">9831282280@upi</span></p>
                        <p className="text-gray-500 text-[11px]">Pay ₹{effectiveAmount.toLocaleString()} via GPay, PhonePe, Paytm, or BHIM.</p>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mt-2 mb-1">Enter 12-Digit UTR / Ref No.</label>
                          <input
                            type="text"
                            placeholder="e.g. 423987123456"
                            value={utrNumber}
                            onChange={(e) => setUtrNumber(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: WhatsApp Support */}
                {activeTab === 'whatsapp' && (
                  <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs">
                        <p className="font-bold text-gray-900 dark:text-white">Need an official GST Invoice or NEFT/RTGS?</p>
                        <p className="text-gray-500 dark:text-gray-400 mt-0.5">Chat directly with the finance desk on WhatsApp.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const msg = `Hello! I want to top up ₹${effectiveAmount} in Voice AI Credits for Shree Mahalaxmi Dashboard.`
                          window.open(`https://wa.me/919831282280?text=${encodeURIComponent(msg)}`, '_blank')
                        }}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat on WhatsApp</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!successData && (
          <div className="p-6 border-t border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Total Payable</p>
              <p className="text-xl font-black text-gray-900 dark:text-white font-mono">
                ₹{effectiveAmount.toLocaleString()}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-bold hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing || effectiveAmount <= 0}
                onClick={handleExecuteTopUp}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-violet-500/20 flex items-center gap-2 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Top-Up...</span>
                  </>
                ) : (
                  <>
                    <span>Add ₹{effectiveAmount.toLocaleString()} Credits</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
