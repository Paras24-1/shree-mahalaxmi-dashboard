'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Conversation, Message } from '@/types'

// In-memory message cache across conversation switches
const messageCache: Record<string, Message[]> = {}

// ----------------------------------------------------------------
// useConversations — fetches all conversations + fast in-memory filtering + realtime + polling fallback
// ----------------------------------------------------------------
export function useConversations(
  filters: {
    search?: string
    stage?: string
    unread?: boolean
    assignFilter?: string
    userId?: string
    isAdmin?: boolean
    userRole?: string
  } = {}
) {
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  // 1. Initial / background fetch of conversations
  const fetchConversations = useCallback(
    async (silent = false) => {
      try {
        const params = new URLSearchParams()
        if (filters.assignFilter && filters.assignFilter !== 'all') {
          params.set('assign_filter', filters.assignFilter)
        }

        const res = await fetch(`/api/conversations?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            setAllConversations(data)
          }
        }
      } catch (err) {
        console.error('Error fetching conversations:', err)
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [filters.assignFilter]
  )

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Periodic polling fallback (every 3.5s) to guarantee real-time updates even if WebSockets are blocked or dropped
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations(true)
    }, 3500)
    return () => clearInterval(interval)
  }, [fetchConversations])

  // 2. Persistent Single Realtime Subscription
  useEffect(() => {
    const channelName = `conversations-realtime-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newConv = payload.new as Conversation
            setAllConversations((prev) => {
              if (prev.some((c) => c.id === newConv.id)) {
                return prev.map((c) => (c.id === newConv.id ? { ...c, ...newConv } : c))
              }
              return [newConv, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedConv = payload.new as Conversation
            setAllConversations((prev) =>
              prev.map((c) => (c.id === updatedConv.id ? { ...c, ...updatedConv } : c))
            )
          } else if (payload.eventType === 'DELETE') {
            const oldConv = payload.old as any
            if (oldConv?.id) {
              setAllConversations((prev) => prev.filter((c) => c.id !== oldConv.id))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // 3. Instant In-Memory Filter (0ms latency on keystroke & tab switch)
  const filteredConversations = useMemo(() => {
    return allConversations.filter((conv) => {
      // Search filter
      if (filters.search?.trim()) {
        const q = filters.search.toLowerCase()
        const nameMatch = conv.name?.toLowerCase().includes(q)
        const phoneMatch = conv.phone_number?.toLowerCase().includes(q)
        if (!nameMatch && !phoneMatch) return false
      }

      // Stage filter
      if (filters.stage) {
        if (filters.stage === 'interested') {
          if (!['interested', 'callback_done_by_ai'].includes(conv.stage)) return false
        } else if (conv.stage !== filters.stage) {
          return false
        }
      }

      // Unread filter
      if (filters.unread && conv.unread_count <= 0) {
        return false
      }

      // Explicit assignment filter (if user selected one from dropdown)
      if (filters.assignFilter && filters.assignFilter !== 'all') {
        if (filters.assignFilter === 'unassigned') {
          if (conv.assigned_to !== null) return false
        } else if (filters.assignFilter === 'assigned') {
          if (conv.assigned_to === null) return false
        } else if (conv.assigned_to !== filters.assignFilter) {
          return false
        }
      }

      return true
    })
  }, [
    allConversations,
    filters.search,
    filters.stage,
    filters.unread,
    filters.assignFilter,
  ])

  return {
    conversations: filteredConversations,
    loading,
    refetch: fetchConversations,
  }
}

// ----------------------------------------------------------------
// useMessages — cached + real-time + polling fallback sub-10ms conversation chat
// ----------------------------------------------------------------
export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (conversationId && messageCache[conversationId]) {
      return messageCache[conversationId]
    }
    return []
  })
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(
    async (silent = false) => {
      if (!conversationId) return

      // If not cached and not silent background poll, show loading
      if (!silent && !messageCache[conversationId]) {
        setLoading(true)
      }

      try {
        const res = await fetch(`/api/messages?conversation_id=${conversationId}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data)) {
            const sorted = [...data].sort(
              (a, b) =>
                new Date(a.timestamp || a.created_at).getTime() -
                new Date(b.timestamp || b.created_at).getTime()
            )

            setMessages((prev) => {
              const tempMsgs = prev.filter((m) => m.id.startsWith('temp-'))
              // Prevent unnecessary state update if message IDs & count are identical
              if (
                tempMsgs.length === 0 &&
                prev.length === sorted.length &&
                prev[prev.length - 1]?.id === sorted[sorted.length - 1]?.id
              ) {
                return prev
              }

              // Combine sorted messages with pending temp messages
              const merged = [...sorted]
              for (const temp of tempMsgs) {
                if (!merged.some((m) => m.message === temp.message && m.direction === temp.direction)) {
                  merged.push(temp)
                }
              }
              messageCache[conversationId] = merged
              return merged
            })
          }
        }
      } catch (err) {
        console.error('Error loading messages:', err)
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [conversationId]
  )

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    if (messageCache[conversationId]) {
      setMessages(messageCache[conversationId])
    } else {
      setMessages([])
    }

    fetchMessages()
  }, [conversationId, fetchMessages])

  // Polling fallback every 3.5s for the active chat
  useEffect(() => {
    if (!conversationId) return
    const interval = setInterval(() => {
      fetchMessages(true)
    }, 3500)
    return () => clearInterval(interval)
  }, [conversationId, fetchMessages])

  // Realtime new messages subscription
  useEffect(() => {
    if (!conversationId) return

    const channelName = `messages-${conversationId}-${Date.now()}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            // Replace any optimistic message with matching text and outgoing direction
            const optIndex = prev.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.message === newMsg.message &&
                m.direction === newMsg.direction
            )
            let next: Message[]
            if (optIndex >= 0) {
              next = [...prev]
              next[optIndex] = newMsg
            } else {
              next = [...prev, newMsg]
            }
            next.sort(
              (a, b) =>
                new Date(a.timestamp || a.created_at).getTime() -
                new Date(b.timestamp || b.created_at).getTime()
            )
            messageCache[conversationId] = next
            return next
          })

          setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 30)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  // Optimistically add an outgoing message to the local list & cache
  const addOptimisticMessage = useCallback(
    (msg: Message) => {
      if (!conversationId) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        const next = [...prev, msg]
        next.sort(
          (a, b) =>
            new Date(a.timestamp || a.created_at).getTime() -
            new Date(b.timestamp || b.created_at).getTime()
        )
        messageCache[conversationId] = next
        return next
      })

      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 30)
    },
    [conversationId]
  )

  // Auto-scroll on message count changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return {
    messages,
    loading,
    bottomRef,
    addOptimisticMessage,
    refetch: fetchMessages,
  }
}

// ----------------------------------------------------------------
// useSendMessage — optimistic & non-blocking send
// ----------------------------------------------------------------
export function useSendMessage() {
  const [sending, setSending] = useState(false)

  const sendMessage = useCallback(
    async (
      conversationId: string,
      phoneNumber: string,
      message: string,
      mediaUrl?: string | null,
      mediaType?: string | null
    ) => {
      if (!message.trim() && !mediaUrl) return null

      setSending(true)

      try {
        const res = await fetch('/api/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            phone_number: phoneNumber,
            message: message.trim(),
            media_url: mediaUrl,
            media_type: mediaType,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          return data
        }
        return null
      } catch (err) {
        console.error('Error sending message:', err)
        return null
      } finally {
        setSending(false)
      }
    },
    []
  )

  return {
    sendMessage,
    sending,
  }
}

// ----------------------------------------------------------------
// useToggleAI — handles AI/human takeover toggle
// ----------------------------------------------------------------
export function useToggleAI() {
  const toggleAI = useCallback(async (conversationId: string, aiMode: boolean) => {
    try {
      await fetch('/api/takeover', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          ai_mode: aiMode,
        }),
      })
    } catch (err) {
      console.error('Error toggling AI:', err)
    }
  }, [])

  return { toggleAI }
}
