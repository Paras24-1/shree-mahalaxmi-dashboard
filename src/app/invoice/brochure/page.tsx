'use client'

import React from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { FileText, Download, Share2 } from 'lucide-react'

export default function BrochurePage() {
  const brochures = [
    { title: 'Automatic Packaging Machine 2026 Catalog', size: '4.2 MB', date: 'Aug 2026' },
    { title: 'Industrial Sealing & Cutting Specs', size: '2.8 MB', date: 'Jul 2026' },
    { title: 'Spare Parts & Maintenance Guide', size: '1.5 MB', date: 'Aug 2026' },
  ]

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Brochures & Catalogs</h1>
        <p className="text-xs text-gray-500">Share official product brochures with leads and customers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {brochures.map((b, i) => (
          <div key={i} className="p-5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950 text-orange-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-gray-900 dark:text-white">{b.title}</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">{b.size} • {b.date}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1">
                <Download className="w-3.5 h-3.5" /> Download
              </button>
              <button className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                <Share2 className="w-3.5 h-3.5" /> WhatsApp
              </button>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  )
}
