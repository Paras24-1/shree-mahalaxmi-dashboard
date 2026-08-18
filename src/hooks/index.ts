'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Conversation, Message } from '@/types'

// In-memory message cache across conversation switches
const messageCache: Record<string, Message[]> = {}

// ----------------------------------------------------------------
// useConversations — fetches all conversations + fast in-memory filtering
// ----------------------------------------------------------------
export function useConversations(filters: {
  search?: string
  stage?: string
  unread?: boolean
  assignFilter?: string
  userId?: string
  isAdmin?: boolean
  userRole?: string
} = {}) {
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  // 1. Initial / background fetch of conversations
  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.userRole === 'employee' && filters.userId) {
        params.set('assigned_to', filters.userId)
      } else if (
        filters.userRole === 'admin' &&
        filters.assignFilter &&
        filters.assignFilter !== 'all'
      ) {
        if (filters.assignFilter === 'unassigned' || filters.assignFilter === 'assigned') {
          params.set('assign_filter', filters.assignFilter)
        } else {
          params.set('assigned_to', filters.assignFilter)
        }
      }

      const res = await fetch(`/api/conversations?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setAllConversations(data)
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [filters.userRole, filters.userId, filters.assignFilter])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // 2. Persistent Single Realtime Subscription (does NOT tear down on search/stage changes)
  useEffect(() => {
    const channel = supabase
      .channel('conversations-realtime-singleton')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newConv = payload.new as Conversation
            setAllConversations((prev) => {
              if (prev.some((c) => c.id === newConv.id)) return prev
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

      // Assignment filter (role-based)
      if (filters.userRole === 'employee' && filters.userId) {
        if (conv.assigned_to !== filters.userId) return false
      } else if (
        filters.userRole === 'admin' &&
        filters.assignFilter &&
        filters.assignFilter !== 'all'
      ) {
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
    filters.userRole,
    filters.userId,
  ])

  return {
    conversations: filteredConversations,
    loading,
    refetch: fetchConversations,
  }
}

// ----------------------------------------------------------------
// useMessages — cached + real-time sub-10ms conversation chat
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

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return

    // If not cached, show loading
    if (!messageCache[conversationId]) {
      setLoading(true)
    }

    try {
      const res = await fetch(`/api/messages?conversation_id=${conversationId}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          messageCache[conversationId] = data
          setMessages(data)
        }
      }
    } catch (err) {
      console.error('Error loading messages:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }

    // Instantly load from cache if available
    if (messageCache[conversationId]) {
      setMessages(messageCache[conversationId])
    }

    fetchMessages()
  }, [conversationId, fetchMessages])

  // Realtime new messages subscription
  useEffect(() => {
    if (!conversationId) return

    const channel = supabase
      .channel(`messages-${conversationId}`)
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
            const next = [...prev, newMsg]
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

  // Auto-scroll on message changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return {
    messages,
    loading,
    bottomRef,
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
      if (!message.trim() && !mediaUrl) return false

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

        return res.ok
      } catch (err) {
        console.error('Error sending message:', err)
        return false
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
  const toggleAI = useCallback(
    async (conversationId: string, aiMode: boolean) => {
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
    },
    []
  )

  return { toggleAI }
}
