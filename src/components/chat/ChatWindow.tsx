'use client'

import { useState, useRef, useEffect } from 'react'
import { Conversation } from '@/types'
import { useMessages, useSendMessage } from '@/hooks'
import { formatDistanceToNow } from 'date-fns'
import { Send, Bot, User, Loader2, Paperclip, X, Tag } from 'lucide-react'

interface Props {
  conversation: Conversation | null
  onAIToggle: (id: string, mode: boolean) => void
}

export default function ChatWindow({ conversation, onAIToggle }: Props) {
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const STAGES = ['new', 'interested', 'booking', 'confirmed', 'cancelled', 'completed', 'followup', 'not_interested', 'call_done', 'low_budget', 'hot_customer', 'not_connected'] as const
  const STAGE_COLORS: Record<string, string> = {
    new:        'bg-gray-100 text-gray-600',
    interested: 'bg-blue-100 text-blue-700',
    booking:    'bg-amber-100 text-amber-700',
    confirmed:  'bg-green-100 text-green-700',
    cancelled:  'bg-red-100 text-red-600',
    completed:  'bg-purple-100 text-purple-700',
   followup:      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  not_interested:'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      call_done:      'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
    low_budget:  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
hot_customer:'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    not_connected:  'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',


  }

  const [stage, setStage] = useState(conversation?.stage || 'new')
  const [savingStage, setSavingStage] = useState(false)
  useEffect(() => {
  setStage(conversation?.stage || 'new')
}, [conversation?.id, conversation?.stage])

  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { messages, loading, bottomRef } = useMessages(conversation?.id || null)
  const { sendMessage, sending } = useSendMessage()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Max 5MB.')
      return
    }

    setImageFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSend = async () => {
    if (!conversation) return
    
    let mediaUrl = null
    let mediaType = null

    // Upload image if selected
    if (imageFile) {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', imageFile)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadRes.ok) {
          const error = await uploadRes.json()
          throw new Error(error.error || 'Upload failed')
        }

        const uploadData = await uploadRes.json()
        mediaUrl = uploadData.url
        mediaType = imageFile.type

        // Clear image after upload
        handleRemoveImage()
      } catch (err: any) {
        alert(err.message || 'Failed to upload image')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    // Send message (text and/or image)
    if (input.trim() || mediaUrl) {
      const success = await sendMessage(
        conversation.id,
        conversation.phone_number,
        input.trim(),
        mediaUrl,
        mediaType
      )
      
      if (success) {
        setInput('')
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleAI = async () => {
    if (!conversation) return
    const newMode = !conversation.ai_mode
    await fetch('/api/takeover', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversation.id, ai_mode: newMode })
    })
    onAIToggle(conversation.id, newMode)
  }

  const handleStageChange = async (newStage: string) => {
    if (!conversation) return
    setSavingStage(true)
    setStage(newStage)

    await fetch(`/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    })

    setSavingStage(false)
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center text-gray-400">
          <p className="text-sm">Select a conversation to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{conversation.name}</h2>
          <p className="text-xs text-gray-500">{conversation.phone_number}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Stage Selector */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-gray-400" />

            <select
              value={stage}
              onChange={(e) => handleStageChange(e.target.value)}
              disabled={savingStage}
              className={`text-xs px-2 py-1 rounded-lg font-medium border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50 ${STAGE_COLORS[stage]}`}
            >
              {STAGES.map(s => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* AI Toggle */}
          <button
            onClick={toggleAI}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              conversation.ai_mode
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400'
            }`}
          >
            {conversation.ai_mode ? (
              <>
                <Bot className="w-3.5 h-3.5" />
                AI Mode
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                Manual
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${msg.direction === 'outgoing' ? 'order-2' : 'order-1'}`}>
                <div
                  className={`rounded-2xl px-4 py-2 ${
                    msg.direction === 'outgoing'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  }`}
                >
                  {msg.media_url && msg.media_type?.startsWith('image/') && (
                    <img
                      src={msg.media_url}
                      alt="Sent image"
                      className="rounded-lg mb-2 max-w-full h-auto"
                    />
                  )}

                  {msg.message && (
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  )}
                </div>

                <p className={`text-xs text-gray-400 mt-1 ${msg.direction === 'outgoing' ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}

        <div ref={bottomRef} />
      </div>

      {/* Image Preview */}
      {imagePreview && (
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-16 h-16 rounded-lg object-cover border-2 border-emerald-500"
              />

              <button
                onClick={handleRemoveImage}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="flex-1">
              <p className="text-xs font-medium text-gray-900 dark:text-white">{imageFile?.name}</p>
              <p className="text-xs text-gray-500">{(imageFile!.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shrink-0">
        <div className="flex items-end gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending || !!imageFile}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Attach image"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message... (Shift+Enter for new line)"
            rows={1}
            className="flex-1 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && !imageFile) || sending || uploading}
            className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
