'use client'

import React, { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { Plus, Search, Trash2, FileText, CheckCircle2, MessageCircle, RefreshCw } from 'lucide-react'

export default function QuotationPage() {
  const [quotations, setQuotations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchQuotations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/invoices?is_quotation=true')
      if (res.ok) {
        const data = await res.json()
        setQuotations(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchQuotations() }, [fetchQuotations])

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Quotations</h1>
          <p className="text-xs text-gray-500">Estimates and pricing proposals for clients</p>
        </div>
        <Link href="/invoice/add" className="px-4 py-2 bg-[#2E285F] text-white rounded-xl text-xs font-bold shadow-sm">
          + Create Quotation
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 text-center shadow-sm">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-gray-500">There are no quotations to display</p>
      </div>
    </DashboardLayout>
  )
}
import Link from 'next/link'
