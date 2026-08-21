'use client'

import React, { useState } from 'react'
import {
  X,
  Coins,
  CheckCircle,
  QrCode,
  MessageSquare,
  Zap,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

interface CreditTopUpModalProps {
  isOpen: boolean
  onClose: () => void
  currentBalance: number
  onTopUpSuccess: (newBalance: number) => void
}

export default function CreditTopUpModal({
  isOpen,
  onClose,
  currentBalance,
  onTopUpSuccess,
}: CreditTopUpModalProps) {
  const [amount, setAmount] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'instant' | 'upi' | 'whatsapp'>('instant')
  const [utrNumber, setUtrNumber] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [successData, setSuccessData] = useState<{ amount: number; newBalance: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const numericAmount = Number(amount) || 0

  const handleAmountChange = (val: string) => {
    const clean = val.replace(/\D/g, '')
    setAmount(clean)
    setErrorMsg(null)
  }

  const handleExecuteTopUp = async () => {
    if (!numericAmount || numericAmount <= 0) {
      setErrorMsg('Please enter a valid top-up amount')
      return
    }

    setIsProcessing(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/voice/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numericAmount,
          transaction_id: utrNumber.trim() || `TOPUP-${Date.now()}`,
          payment_method: activeTab === 'upi' ? `UPI (UTR: ${utrNumber})` : 'Direct Top-Up',
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setSuccessData({
          amount: numericAmount,
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
    setAmount('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-150 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900 dark:text-white">
                Top Up Voice AI Credits
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Add credits directly to your AI wallet</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Current Balance Display */}
          <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Balance</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white font-mono mt-0.5">
                ₹{Number(currentBalance).toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/30 text-xs font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Active Wallet
            </div>
          </div>

          {successData ? (
            /* Success Screen */
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Credits Added Successfully</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ₹{successData.amount.toLocaleString()} has been added to your Voice AI wallet.
              </p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                New Balance: ₹{Number(successData.newBalance).toFixed(2)}
              </p>
              <button
                onClick={handleResetAndClose}
                className="mt-4 w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Enter Amount to Add (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-base">₹</span>
                  <input
                    type="text"
                    required
                    placeholder="Enter amount (e.g. 500, 1000, 5000)"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 text-base font-mono font-bold rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-violet-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Payment Mode Tabs */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
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
                    <span>Direct Top-Up</span>
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
                    <span>UPI QR</span>
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
                    <span>WhatsApp</span>
                  </button>
                </div>

                {activeTab === 'instant' && (
                  <div className="bg-violet-50/40 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/40 rounded-2xl p-3.5 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-violet-600 shrink-0" />
                    <span>Credits are credited directly to your Voice AI balance.</span>
                  </div>
                )}

                {activeTab === 'upi' && (
                  <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-700 dark:text-gray-300">UPI ID:</span>
                      <span className="font-mono font-bold text-violet-600 dark:text-violet-400">9831282280@upi</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                        UTR / Transaction ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 423987123456"
                        value={utrNumber}
                        onChange={(e) => setUtrNumber(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'whatsapp' && (
                  <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-3.5 flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Top up via WhatsApp billing support</span>
                    <button
                      type="button"
                      onClick={() => {
                        const msg = `Hello! I want to top up ₹${numericAmount || ''} in Voice AI Credits for Shree Mahalaxmi Dashboard.`
                        window.open(`https://wa.me/919831282280?text=${encodeURIComponent(msg)}`, '_blank')
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1 shrink-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium">
                  {errorMsg}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!successData && (
          <div className="p-5 border-t border-gray-150 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Amount</p>
              <p className="text-lg font-black text-gray-900 dark:text-white font-mono">
                ₹{numericAmount > 0 ? numericAmount.toLocaleString() : '0'}
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
                disabled={isProcessing || numericAmount <= 0}
                onClick={handleExecuteTopUp}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Add ₹{numericAmount > 0 ? numericAmount.toLocaleString() : '0'} Credits</span>
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
