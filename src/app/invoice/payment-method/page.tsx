'use client'

import React from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { CreditCard, QrCode, Building, Banknote } from 'lucide-react'

export default function PaymentMethodsPage() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Payment Methods</h1>
        <p className="text-xs text-gray-500">Manage bank details, UPI QR codes, and gateway settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold">
            <Building className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold">Bank Account Transfer (NEFT/RTGS)</h3>
          <p className="text-xs text-gray-500">Bank: HDFC Bank Ltd.<br />A/C: 50200012345678<br />IFSC: HDFC0001234</p>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center font-bold">
            <QrCode className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold">UPI Payments</h3>
          <p className="text-xs text-gray-500">UPI ID: shreemahalaxmi@hdfcbank<br />Google Pay / PhonePe / Paytm enabled</p>
        </div>

        <div className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
            <Banknote className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold">Cash & Cheque</h3>
          <p className="text-xs text-gray-500">Direct on-delivery or physical branch payments</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
