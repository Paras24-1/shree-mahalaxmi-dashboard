'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Conversation, Message } from '@/types'

// ----------------------------------------------------------------
// useConversations — fetches + subscribes to all conversations
// ----------------------------------------------------------------
export function useConversations(filters: {
  search?: string
  stage?: string
  unread?: boolean
  assignFilter?: 'all' | 'unassigned' | 'assigned'
  userId?: string
  isAdmin?: boolean
} = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    const params = new URLSearchParams()
    if (filters.search)       params.set('search', filters.search)
    if (filters.stage)        params.set('stage',  filters.stage)
    if (filters.unread)       params.set('unread', 'true')
    if (!filters.isAdmin && filters.userId)
                              params.set('assigned_to', filters.userId)
    if (filters.isAdmin && filters.assignFilter && filters.assignFilter !== 'all')
                              params.set('assign_filter', filters.assignFilter)

    const res = await fetch(`/api/conversations?${params}`)
    const data = await res.json()
    if (Array.isArray(data)) setConversations(data)
    setLoading(false)
  }, [filters.search, filters.stage, filters.unread, filters.assignFilter, filters.userId, filters.isAdmin])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Subscribe to real-time changes on conversations
  useEffect(() => {
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => fetchConversations()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchConversations])

  return { conversations, loading, refetch: fetchConversations }
}

// ----------------------------------------------------------------
// useMessages — fetches + subscribes to a conversation's messages
// ----------------------------------------------------------------
export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return
    setLoading(true)
    const res = await fetch(`/api/messages?conversation_id=${conversationId}`)
    const data = await res.json()
    if (Array.isArray(data)) setMessages(data)
    setLoading(false)
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    fetchMessages()
  }, [conversationId, fetchMessages])

  // Subscribe to real-time new messages
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
          setMessages((prev) => [...prev, payload.new as Message])
          setTimeout(() => {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId])

  // Auto-scroll on messages load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  return { messages, loading, bottomRef }
}

// ----------------------------------------------------------------
// useSendMessage — handles sending replies
// ----------------------------------------------------------------
export function useSendMessage() {
  const [sending, setSending] = useState(false)

  const sendMessage = useCallback(
    async (conversationId: string, phoneNumber: string, message: string) => {
      if (!message.trim()) return false
      setSending(true)
      try {
        const res = await fetch('/api/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            phone_number: phoneNumber,
            message: message.trim(),
          }),
        })
        return res.ok
      } finally {
        setSending(false)
      }
    },
    []
  )

  return { sendMessage, sending }
}

// ----------------------------------------------------------------
// useToggleAI — handles the AI/human takeover toggle
// ----------------------------------------------------------------
export function useToggleAI() {
  const toggleAI = useCallback(
    async (conversationId: string, aiMode: boolean) => {
      await fetch('/api/takeover', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, ai_mode: aiMode }),
      })
    },
    []
  )
  return { toggleAI }
}
