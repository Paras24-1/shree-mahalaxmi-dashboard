'use client'

import { Search, FileText, ChevronDown, Plus, MoreVertical, SlidersHorizontal, LayoutGrid, List } from 'lucide-react'

export default function LeadHeader() {
  return (
    <div className="flex items-center justify-between py-2 sm:py-4 mb-2 sm:mb-4 flex-wrap gap-2">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Leads</h2>
      
      <div className="flex items-center gap-3">
        {/* Reports Dropdown */}
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <FileText className="w-4 h-4 text-gray-400" />
          <span>Reports</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
        </button>

        {/* Filter Dropdown */}
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors bg-gray-50 dark:bg-gray-850">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
          <span>Filter</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
        </button>

        {/* View Toggle */}
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
          <button className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-r border-gray-200 dark:border-gray-700">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button className="p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
