'use client'

import { useState, useEffect } from 'react'
import { StickyNote, Plus, Pin, Edit, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function StickyNotesWidget() {
  const [notes, setNotes] = useState<any[]>([])
  const [adding, setAdding] = useState(false)
  const [newContent, setNewContent] = useState('')

  useEffect(() => {
    loadNotes()
  }, [])

  async function loadNotes() {
    const { data } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
    if (data) setNotes(data)
  }

  async function handleAdd() {
    if (!newContent.trim()) return
    await supabase.from('notes').insert({ content: newContent, color: 'green' })
    setNewContent('')
    setAdding(false)
    loadNotes()
  }

  async function handleDelete(id: string) {
    await supabase.from('notes').delete().eq('id', id)
    loadNotes()
  }

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col min-h-[250px]">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-blue-800" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Sticky Notes</h3>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 bg-indigo-900 text-white px-3 py-1.5 rounded-md text-sm font-semibold hover:bg-indigo-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Note
        </button>
      </div>

      <div className="p-6 flex-1 flex flex-wrap gap-4 overflow-y-auto">
        {adding && (
          <div className="relative w-64 h-48 bg-green-100 rounded-lg p-4 shadow-sm border border-green-200">
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full h-24 bg-transparent resize-none outline-none text-green-900 placeholder-green-700/50 text-sm"
              placeholder="Write your note..."
              autoFocus
            />
            <div className="absolute bottom-4 right-4 flex gap-2">
              <button onClick={() => setAdding(false)} className="text-xs text-gray-500 hover:text-gray-800">Cancel</button>
              <button onClick={handleAdd} className="text-xs font-bold text-green-800 hover:text-green-900">Save</button>
            </div>
          </div>
        )}

        {notes.map(note => (
          <div key={note.id} className="relative w-64 h-48 bg-green-100 rounded-bl-3xl rounded-tr-lg rounded-tl-lg rounded-br-lg p-4 shadow-sm border border-green-200 flex flex-col">
            <Pin className="absolute -top-3 -right-3 w-8 h-8 text-green-600 fill-current transform rotate-45" />
            <h4 className="text-green-800 font-bold text-sm mb-2">Notes</h4>
            <p className="text-sm text-green-900 flex-1">{note.content}</p>
            
            <div className="flex justify-end gap-2 mt-2 opacity-50 hover:opacity-100 transition-opacity">
              <button className="text-green-700 hover:text-green-900"><Edit className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(note.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}

        {!adding && notes.length === 0 && (
           <div className="m-auto text-center opacity-30">
            <StickyNote className="w-16 h-16 mx-auto mb-2" />
            <p className="text-sm font-bold">There Are No Notes to Display</p>
          </div>
        )}
      </div>
    </div>
  )
}
