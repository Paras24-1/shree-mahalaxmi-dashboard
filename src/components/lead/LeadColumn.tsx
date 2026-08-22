'use client'

import { ReactNode } from 'react'

interface LeadColumnProps {
  title: string
  subtitle?: string
  count: number
  colorClass: string
  headerBg: string
  children: ReactNode
  onDrop: (leadId: string) => void
}

export default function LeadColumn({ title, subtitle, count, colorClass, headerBg, children, onDrop }: LeadColumnProps) {
  return (
    <div
      className="flex-1 min-w-[300px] max-w-[350px] flex flex-col h-full"
      onDragOver={(e) => {
        e.preventDefault() // Necessary to allow dropping
      }}
      onDrop={(e) => {
        e.preventDefault()
        const leadId = e.dataTransfer.getData('leadId')
        if (leadId) onDrop(leadId)
      }}
    >
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-lg ${headerBg} text-white`}>
        <div>
          <h3 className="font-bold text-sm">{title}</h3>
          {subtitle && <p className="text-[10px] text-white/80 font-normal">{subtitle}</p>}
        </div>
        <span className="bg-pink-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>
      
      {/* Column body with styling to show active drop area if needed, and scrollable area for cards */}
      <div className={`flex-1 bg-gray-50/50 dark:bg-gray-900/20 p-3 overflow-y-auto border-x border-b border-gray-200 dark:border-gray-800 rounded-b-lg border-t-4 ${colorClass}`}>
        {children}
      </div>
    </div>
  )
}
