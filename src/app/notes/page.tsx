'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import {
  Plus, Search, Trash2, Edit2, Eye, X, Check, RefreshCw,
  StickyNote, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Copy, CheckCheck
} from 'lucide-react'

interface Note {
  id: string
  content: string
  title?: string
  type?: string
  color?: string
  created_at: string
  updated_at?: string
}

const NOTE_TYPES = ['Note', 'Meeting', 'Call Summary', 'Lead Followup', 'Task Note', 'Personal', 'General']

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination state
  const [pageSize, setPageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)

  // Form state
  const [modalContent, setModalContent] = useState('')
  const [modalType, setModalType] = useState('Note')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // ── Fetch Notes ────────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notes')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Note[] = await res.json()
      setNotes(data)
    } catch (err) {
      console.error('Error fetching notes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // ── Modal Actions ──────────────────────────────────────────────────────────

  const openAddModal = () => {
    setSelectedNote(null)
    setModalContent('')
    setModalType('Note')
    setShowAddModal(true)
  }

  const openEditModal = (note: Note) => {
    setSelectedNote(note)
    setModalContent(note.content)
    setModalType(note.type || 'Note')
    setShowEditModal(true)
  }

  const openViewModal = (note: Note) => {
    setSelectedNote(note)
    setCopied(false)
    setShowViewModal(true)
  }

  const handleSave = async () => {
    if (!modalContent.trim()) return
    setSaving(true)
    try {
      const payload = {
        content: modalContent.trim(),
        type: modalType,
        color: 'green',
      }

      if (selectedNote && showEditModal) {
        const res = await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedNote.id, ...payload }),
        })
        if (!res.ok) throw new Error('Failed to update')
        setShowEditModal(false)
      } else {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
        setShowAddModal(false)
      }

      await fetchNotes()
    } catch (err) {
      console.error('Error saving note:', err)
      alert('Failed to save note. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/notes?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setNotes((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      console.error('Error deleting note:', err)
      alert('Failed to delete note.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCopyNote = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Filtered & Paginated Data ──────────────────────────────────────────────

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const contentMatch = n.content.toLowerCase().includes(searchQuery.toLowerCase())
      const typeMatch = (n.type || 'Note').toLowerCase().includes(searchQuery.toLowerCase())
      return contentMatch || typeMatch
    })
  }, [notes, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredNotes.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedNotes = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize
    return filteredNotes.slice(start, start + pageSize)
  }, [filteredNotes, safeCurrentPage, pageSize])

  const startRecord = filteredNotes.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1
  const endRecord = Math.min(safeCurrentPage * pageSize, filteredNotes.length)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notes</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9 pr-8 py-2 text-xs border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-64 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Add Note Button */}
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2B2B6E] hover:bg-[#202058] dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Note</span>
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-3" />
            <p className="text-sm text-gray-500">Loading notes...</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left border-collapse">
                {/* Navy Header */}
                <thead>
                  <tr className="bg-[#2E285F] text-white text-xs font-bold uppercase tracking-wider">
                    <th className="py-3 px-4 w-16 text-center">No.</th>
                    <th className="py-3 px-6 w-32">Actions</th>
                    <th className="py-3 px-6">Note</th>
                    <th className="py-3 px-6 w-40">Type</th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {paginatedNotes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-16 text-center text-gray-400 dark:text-gray-500">
                        <StickyNote className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">There are no records to display</p>
                        {searchQuery && (
                          <p className="text-[11px] mt-1 text-gray-400">Try adjusting your search query</p>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedNotes.map((note, index) => {
                      const rowNumber = (safeCurrentPage - 1) * pageSize + index + 1
                      const isDeleting = deletingId === note.id

                      return (
                        <tr
                          key={note.id}
                          className="hover:bg-gray-50/70 dark:hover:bg-gray-850/50 transition-colors text-gray-700 dark:text-gray-300"
                        >
                          {/* Number */}
                          <td className="py-3.5 px-4 text-center font-medium text-gray-500 dark:text-gray-400">
                            {rowNumber}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-6">
                            <div className="flex items-center gap-2">
                              {/* Edit (Orange) */}
                              <button
                                onClick={() => openEditModal(note)}
                                className="text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 p-1 rounded-md transition-colors"
                                title="Edit Note"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Delete (Red) */}
                              <button
                                onClick={() => handleDelete(note.id)}
                                disabled={isDeleting}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 p-1 rounded-md transition-colors disabled:opacity-50"
                                title="Delete Note"
                              >
                                {isDeleting ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>

                              {/* View (Blue/Purple Eye) */}
                              <button
                                onClick={() => openViewModal(note)}
                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 p-1 rounded-md transition-colors"
                                title="View Note"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </td>

                          {/* Note Content */}
                          <td className="py-3.5 px-6 font-medium text-gray-900 dark:text-white">
                            <span className="line-clamp-2 max-w-xl">{note.content}</span>
                          </td>

                          {/* Type */}
                          <td className="py-3.5 px-6">
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                              {note.type || 'Note'}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="py-3 px-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
              {/* Rows Per Page */}
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="ml-2 font-medium">
                  {startRecord} - {endRecord} of {filteredNotes.length}
                </span>
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  className="p-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800"
                  title="First Page"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={safeCurrentPage}
                    onChange={(e) => {
                      const val = Number(e.target.value)
                      if (val >= 1 && val <= totalPages) setCurrentPage(val)
                    }}
                    className="w-10 text-center py-1 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-xs font-semibold text-gray-800 dark:text-gray-200"
                  />
                  <span>of {totalPages}</span>
                </div>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-800"
                  title="Last Page"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div
            className="absolute inset-0"
            onClick={() => {
              setShowAddModal(false)
              setShowEditModal(false)
            }}
          />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl max-h-[90%] overflow-y-auto z-50 flex flex-col space-y-4 text-gray-900 dark:text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setShowEditModal(false)
                  }}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
                <h4 className="text-sm font-bold">
                  {showEditModal ? 'Edit Note' : 'Add Note'}
                </h4>
              </div>
            </div>

            {/* Note Content */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Note Content *
              </label>
              <textarea
                value={modalContent}
                onChange={(e) => setModalContent(e.target.value)}
                placeholder="e.g. Sagar pinjan Visit - Discussed new machinery requirements..."
                rows={4}
                className="w-full text-xs text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400 resize-none"
                autoFocus
              />
            </div>

            {/* Type Selector */}
            <div className="flex flex-col space-y-1">
              <label className="block text-[10px] text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {NOTE_TYPES.slice(0, 6).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setModalType(type)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all text-center ${
                      modalType === type
                        ? 'bg-[#2E285F] text-white border-transparent shadow-2xs'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false)
                  setShowEditModal(false)
                }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !modalContent.trim()}
                className="flex-1 py-2.5 bg-[#2E285F] hover:bg-[#202058] dark:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {showEditModal ? 'Save Changes' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Note Modal ─────────────────────────────────────────────────── */}
      {showViewModal && selectedNote && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="absolute inset-0" onClick={() => setShowViewModal(false)} />
          <div className="relative w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl md:rounded-2xl border-t md:border border-gray-200 dark:border-gray-800 p-5 shadow-2xl z-50 flex flex-col space-y-4 text-gray-900 dark:text-white">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60">
                  {selectedNote.type || 'Note'}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(selectedNote.created_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Note Content */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-100 dark:border-gray-800 max-h-64 overflow-y-auto">
              <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                {selectedNote.content}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleCopyNote(selectedNote.content)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to clipboard' : 'Copy note'}</span>
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false)
                  openEditModal(selectedNote)
                }}
                className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
