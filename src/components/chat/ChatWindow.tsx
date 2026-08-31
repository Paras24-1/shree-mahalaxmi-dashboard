import { useState, useRef, useEffect } from 'react'
import { Conversation } from '@/types'
import { useMessages, useSendMessage } from '@/hooks'
import { formatDistanceToNow } from 'date-fns'
import {
  Send,
  Bot,
  User,
  Loader2,
  Paperclip,
  X,
  Tag,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Edit3,
  Save,
  ChevronDown,
  ChevronUp,
  Target,
  Wrench,
  ArrowRight,
  Info,
} from 'lucide-react'

interface Props {
  conversation: Conversation | null
  onAIToggle: (id: string, mode: boolean) => void
  onStageChange?: (id: string, stage: string) => void
  onToggleLeadPanel?: () => void
  showLeadPanel?: boolean
}

interface SummaryData {
  overview: string
  intent: string
  products: string[]
  keyPoints: string[]
  nextAction: string
  sentiment: 'positive' | 'neutral' | 'inquiry' | 'urgent'
}

export default function ChatWindow({
  conversation,
  onAIToggle,
  onStageChange,
  onToggleLeadPanel,
  showLeadPanel,
}: Props) {
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // AI Summary State
  const [showSummary, setShowSummary] = useState(false)
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [copiedSummary, setCopiedSummary] = useState(false)
  const [isEditingSummary, setIsEditingSummary] = useState(false)
  const [customSummaryText, setCustomSummaryText] = useState('')
  const [savingSummary, setSavingSummary] = useState(false)

  const STAGES = ['new', 'callback_done_by_ai', 'interested', 'booking', 'confirmed', 'cancelled', 'completed', 'followup', 'not_interested', 'call_done', 'low_budget', 'hot_customer', 'not_connected'] as const
  const STAGE_COLORS: Record<string, string> = {
    new:        'bg-gray-100 text-gray-600',
    callback_done_by_ai: 'bg-blue-100 text-blue-700',
    interested: 'bg-indigo-100 text-indigo-700',
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
  
  const { messages, loading, bottomRef, addOptimisticMessage } = useMessages(conversation?.id || null)
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
    
    const textToSend = input.trim()
    const currentPreview = imagePreview
    const currentFileType = imageFile?.type || null
    let mediaUrl = null
    let mediaType = null

    if (!textToSend && !imageFile) return

    // Clear input & previews early for instant snappy feel
    setInput('')
    handleRemoveImage()

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
        mediaType = currentFileType
      } catch (err: any) {
        alert(err.message || 'Failed to upload image')
        setUploading(false)
        return
      }
      setUploading(false)
    }

    // Add optimistic message locally
    const nowIso = new Date().toISOString()
    addOptimisticMessage({
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      phone_number: conversation.phone_number,
      message: textToSend,
      direction: 'outgoing',
      timestamp: nowIso,
      created_at: nowIso,
      media_url: mediaUrl || currentPreview || null,
      media_type: mediaType || currentFileType || null,
    })

    // Send message via API
    await sendMessage(
      conversation.id,
      conversation.phone_number,
      textToSend,
      mediaUrl,
      mediaType
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
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
    onStageChange?.(conversation.id, newStage)

    // Update memory store / cache if present so returning to leads board preserves the new tag
    if (typeof window !== 'undefined') {
      try {
        const savedCache = sessionStorage.getItem('shree_leads_state_cache')
        if (savedCache) {
          const parsed = JSON.parse(savedCache)
          if (Array.isArray(parsed.leads)) {
            parsed.leads = parsed.leads.map((l: any) =>
              l.id === conversation.id || l.conversation_id === conversation.id
                ? { ...l, stage: newStage, updated_at: new Date().toISOString() }
                : l
            )
            sessionStorage.setItem('shree_leads_state_cache', JSON.stringify(parsed))
          }
        }
      } catch {}
    }

    try {
      await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          stage: newStage,
        }),
      })
    } catch {}

    await fetch(`/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage })
    })

    setSavingStage(false)
  }

  const fetchSummary = async (force = false) => {
    if (!conversation?.id) return
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/summary?conversation_id=${conversation.id}&t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.summary) {
          setSummaryData(data.summary)
          setCustomSummaryText(data.savedSummary || data.summary.overview)
        }
      }
    } catch (err) {
      console.error('Failed to load summary:', err)
    } finally {
      setLoadingSummary(false)
    }
  }

  useEffect(() => {
    if (conversation?.id) {
      fetchSummary()
    } else {
      setSummaryData(null)
      setShowSummary(false)
    }
  }, [conversation?.id])

  const handleCopySummary = () => {
    if (!summaryData) return
    const text = `📋 Chat Summary for ${conversation?.name || conversation?.phone_number}:
• Intent: ${summaryData.intent}
• Overview: ${summaryData.overview}
• Key Points:
${summaryData.keyPoints.map((p) => `  - ${p}`).join('\n')}
• Next Action: ${summaryData.nextAction}`

    navigator.clipboard.writeText(text)
    setCopiedSummary(true)
    setTimeout(() => setCopiedSummary(false), 2000)
  }

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 flex items-center justify-between shrink-0 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{conversation.name || conversation.phone_number}</h2>
          <p className="text-xs text-gray-500">{conversation.phone_number}</p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* AI Summary Toggle Button */}
          <button
            onClick={() => {
              if (!showSummary && !summaryData) {
                fetchSummary()
              }
              setShowSummary((v) => !v)
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              showSummary
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
            }`}
            title="Toggle AI Chat Summary"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500 fill-current" />
            <span className="hidden sm:inline">AI Summary</span>
            <span className="sm:hidden">Summary</span>
          </button>

          {/* Stage Selector */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-gray-400" />

            <select
              value={stage}
              onChange={(e) => handleStageChange(e.target.value)}
              disabled={savingStage}
              className={`text-xs px-2 py-1 rounded-lg font-medium border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50 ${STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600'}`}
            >
              {STAGES.map(s => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ').charAt(0).toUpperCase() + s.replace(/_/g, ' ').slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Lead Info Toggle Button */}
          {onToggleLeadPanel && (
            <button
              onClick={onToggleLeadPanel}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                showLeadPanel
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
              }`}
              title="Toggle Lead Details"
            >
              <Info className="w-3.5 h-3.5" />
              <span className="inline">Lead Info</span>
            </button>
          )}

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

      {/* Expandable AI Chat Summary Drawer / Banner */}
      {showSummary && (
        <div className="bg-gradient-to-r from-purple-50/90 via-indigo-50/70 to-blue-50/90 dark:from-gray-900 dark:via-purple-950/20 dark:to-gray-900 border-b border-purple-100 dark:border-purple-900/40 p-3.5 transition-all">
          <div className="max-w-4xl mx-auto space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">Chat Summary & Intelligence</span>
                  {summaryData?.intent && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                      {summaryData.intent}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchSummary(true)}
                  disabled={loadingSummary}
                  className="px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800 transition-colors text-[11px] font-medium flex items-center gap-1"
                  title="Regenerate Summary"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSummary ? 'animate-spin text-purple-600' : ''}`} />
                  <span>Regenerate</span>
                </button>

                <button
                  onClick={handleCopySummary}
                  disabled={!summaryData}
                  className="px-2 py-1 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-800 transition-colors text-[11px] font-medium flex items-center gap-1"
                  title="Copy Summary"
                >
                  {copiedSummary ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => setShowSummary(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {loadingSummary ? (
              <div className="py-3 flex items-center justify-center gap-2 text-xs text-purple-600 font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing conversation history...</span>
              </div>
            ) : summaryData ? (
              <div className="space-y-2 text-xs">
                <div className="bg-white/90 dark:bg-gray-950/90 rounded-xl p-2.5 border border-purple-100/60 dark:border-purple-900/30 shadow-2xs">
                  <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                    {summaryData.overview}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="bg-white/70 dark:bg-gray-950/70 rounded-xl p-2.5 border border-purple-100/40 dark:border-purple-900/20">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Target className="w-3 h-3 text-purple-500" /> Key Discussion Points
                    </p>
                    <ul className="space-y-0.5 text-gray-700 dark:text-gray-300">
                      {summaryData.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-1 text-[11px]">
                          <span className="text-purple-500 font-bold">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-white/70 dark:bg-gray-950/70 rounded-xl p-2.5 border border-purple-100/40 dark:border-purple-900/20 flex flex-col justify-between space-y-1.5">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3 text-emerald-500" /> Recommended Next Action
                      </p>
                      <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {summaryData.nextAction}
                      </p>
                    </div>

                    {summaryData.products.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-blue-500" /> Products Mentioned
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {summaryData.products.map((p, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-semibold"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => {
            const timeStr = formatMessageTime(msg.timestamp || msg.created_at)
            const isImage = (msg.media_type?.startsWith('image/') || msg.media_url?.match(/\.(jpeg|jpg|gif|png|webp)/i))

            return (
              <div
                key={msg.id}
                className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] ${msg.direction === 'outgoing' ? 'order-2' : 'order-1'}`}>
                  <div
                    className={`rounded-2xl px-4 py-2 shadow-2xs ${
                      msg.direction === 'outgoing'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    }`}
                  >
                    {msg.media_url && isImage && (
                      <img
                        src={msg.media_url}
                        alt="Media attachment"
                        className="rounded-lg mb-2 max-w-full h-auto max-h-72 object-contain"
                      />
                    )}

                    {msg.media_url && !isImage && (
                      <a
                        href={msg.media_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline block text-xs mb-1 font-semibold"
                      >
                        📎 View Attachment
                      </a>
                    )}

                    {msg.message && (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    )}
                  </div>

                  {timeStr && (
                    <p className={`text-[10px] text-gray-400 mt-1 ${msg.direction === 'outgoing' ? 'text-right' : 'text-left'}`}>
                      {timeStr}
                    </p>
                  )}
                </div>
              </div>
            )
          })
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
            onKeyDown={handleKeyDown}
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
