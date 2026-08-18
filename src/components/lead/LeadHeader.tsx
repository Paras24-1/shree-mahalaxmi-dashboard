'use client'

import { Search, FileText, ChevronDown, Plus, MoreVertical, SlidersHorizontal, LayoutGrid, List } from 'lucide-react'

export default function LeadHeader() {
  return (
    <div className="flex items-center justify-between py-4 mb-4">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Leads</h2>
      
      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="p-2 border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <Search className="w-4 h-4" />
        </button>

        {/* Reports Dropdown */}
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <FileText className="w-4 h-4 text-gray-500" />
          Reports
          <ChevronDown className="w-4 h-4 text-gray-500 ml-1" />
        </button>

        {/* Add Lead Button */}
        <button className="flex items-center gap-1 px-4 py-2 bg-indigo-900 text-white rounded-md text-sm font-medium shadow-sm hover:bg-indigo-800 transition-colors">
          <Plus className="w-4 h-4" />
          Add Lead
        </button>

        {/* More Actions */}
        <button className="p-2 bg-indigo-900 text-white rounded-md shadow-sm hover:bg-indigo-800 transition-colors">
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Filter Dropdown */}
        <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors bg-gray-50 dark:bg-gray-800">
          <SlidersHorizontal className="w-4 h-4 text-gray-500" />
          Filter
          <ChevronDown className="w-4 h-4 text-gray-500 ml-1" />
        </button>

        {/* View Toggle */}
        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-900">
          <button className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 border-r border-gray-200 dark:border-gray-700">
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
