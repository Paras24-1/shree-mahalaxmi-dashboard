'use client'

import React, { useState, useEffect } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import { Megaphone, Plus, MessageCircle, Users, CheckCircle2, Clock, Play, RefreshCw, Eye } from 'lucide-react'

export default function CampaignPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">WhatsApp Campaigns</h1>
          <p className="text-xs text-gray-500">Broadcast automated messages, templates, and promotional offers</p>
        </div>
        <Link
          href="/bulk"
          className="flex items-center gap-2 px-4 py-2 bg-[#2E285F] hover:bg-[#201c44] text-white text-xs font-bold rounded-xl shadow-sm self-start"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Campaign</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
          <div className="text-xs text-gray-500 font-bold uppercase">Total Campaigns</div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">12</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">● 9 Completed successfully</div>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
          <div className="text-xs text-gray-500 font-bold uppercase">Messages Delivered</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">4,850</div>
          <div className="text-[11px] text-gray-400 mt-1">98.4% Delivery Rate</div>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
          <div className="text-xs text-gray-500 font-bold uppercase">Active Templates</div>
          <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">6</div>
          <div className="text-[11px] text-gray-400 mt-1">Approved by Meta API</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-12 text-center">
        <Megaphone className="w-12 h-12 text-purple-400 mx-auto mb-3 opacity-60" />
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Start Your First WhatsApp Broadcast</h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
          Select target leads, choose an approved WhatsApp template, and schedule message delivery.
        </p>
        <Link
          href="/bulk"
          className="px-5 py-2.5 bg-gradient-to-r from-blue-900 to-pink-500 text-white text-xs font-bold rounded-xl shadow-md inline-flex items-center gap-1.5"
        >
          <MessageCircle className="w-4 h-4" /> Open Bulk Broadcast Tool
        </Link>
      </div>
    </DashboardLayout>
  )
}
