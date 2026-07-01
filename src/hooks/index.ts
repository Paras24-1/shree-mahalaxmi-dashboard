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
  assignFilter?: string
  userId?: string
  isAdmin?: boolean
  userRole?: string
} = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    // Wait until we know the user's role before fetching
    if (!filters.userRole || !filters.userId) return

    const params = new URLSearchParams()

    if (filters.search) params.set('search', filters.search)
    if (filters.stage) params.set('stage', filters.stage)
    if (filters.unread) params.set('unread', 'true')

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
        // Specific employee ID selected
        params.set('assigned_to', filters.assignFilter)
      }
    }

    const res = await fetch(`/api/conversations?${params}`)
    const data = await res.json()

    if (Array.isArray(data)) setConversations(data)

    setLoading(false)
  }, [
    filters.search,
    filters.stage,
    filters.unread,
    filters.assignFilter,
    filters.userId,
    filters.isAdmin,
    filters.userRole,
  ])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Subscribe to real-time changes on conversations
  useEffect(() => {
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newConv = payload.new as Conversation
            
            // Check filters
            let matches = true
            if (filters.search) {
              const s = filters.search.toLowerCase()
              const nameMatch = newConv.name?.toLowerCase().includes(s) || false
              const phoneMatch = newConv.phone_number?.toLowerCase().includes(s) || false
              if (!nameMatch && !phoneMatch) matches = false
            }
            if (filters.stage) {
              if (filters.stage === 'interested') {
                if (!['interested', 'callback_done_by_ai'].includes(newConv.stage)) matches = false
              } else {
                if (newConv.stage !== filters.stage) matches = false
              }
            }
            if (filters.unread && newConv.unread_count <= 0) {
              matches = false
            }
            if (filters.userRole === 'employee' && filters.userId) {
              if (newConv.assigned_to !== filters.userId) matches = false
            } else if (
              filters.userRole === 'admin' &&
              filters.assignFilter &&
              filters.assignFilter !== 'all'
            ) {
              if (filters.assignFilter === 'unassigned') {
                if (newConv.assigned_to !== null) matches = false
              } else if (filters.assignFilter === 'assigned') {
                if (newConv.assigned_to === null) matches = false
              } else {
                if (newConv.assigned_to !== filters.assignFilter) matches = false
              }
            }

            if (matches) {
              setConversations((prev) => {
                if (prev.some(c => c.id === newConv.id)) return prev
                return [newConv, ...prev]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedConv = payload.new as Conversation
            
            // Check filters
            let matches = true
            if (filters.search) {
              const s = filters.search.toLowerCase()
              const nameMatch = updatedConv.name?.toLowerCase().includes(s) || false
              const phoneMatch = updatedConv.phone_number?.toLowerCase().includes(s) || false
              if (!nameMatch && !phoneMatch) matches = false
            }
            if (filters.stage) {
              if (filters.stage === 'interested') {
                if (!['interested', 'callback_done_by_ai'].includes(updatedConv.stage)) matches = false
              } else {
                if (updatedConv.stage !== filters.stage) matches = false
              }
            }
            if (filters.unread && updatedConv.unread_count <= 0) {
              matches = false
            }
            if (filters.userRole === 'employee' && filters.userId) {
              if (updatedConv.assigned_to !== filters.userId) matches = false
            } else if (
              filters.userRole === 'admin' &&
              filters.assignFilter &&
              filters.assignFilter !== 'all'
            ) {
              if (filters.assignFilter === 'unassigned') {
                if (updatedConv.assigned_to !== null) matches = false
              } else if (filters.assignFilter === 'assigned') {
                if (updatedConv.assigned_to === null) matches = false
              } else {
                if (updatedConv.assigned_to !== filters.assignFilter) matches = false
              }
            }

            setConversations((prev) => {
              const exists = prev.some(c => c.id === updatedConv.id)
              if (matches) {
                if (exists) {
                  return prev.map(c => c.id === updatedConv.id ? { ...c, ...updatedConv } : c)
                } else {
                  return [updatedConv, ...prev]
                }
              } else {
                if (exists) {
                  return prev.filter(c => c.id !== updatedConv.id)
                }
                return prev
              }
            })
          } else if (payload.eventType === 'DELETE') {
            const oldConv = payload.old as any
            if (oldConv?.id) {
              setConversations((prev) => prev.filter(c => c.id !== oldConv.id))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchConversations, filters.search, filters.stage, filters.unread, filters.assignFilter, filters.userId, filters.userRole])

  return {
    conversations,
    loading,
    refetch: fetchConversations,
  }
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

    const res = await fetch(
      `/api/messages?conversation_id=${conversationId}`
    )

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
            bottomRef.current?.scrollIntoView({
              behavior: 'smooth',
            })
          }, 50)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  // Auto-scroll on messages load
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages.length])

  return {
    messages,
    loading,
    bottomRef,
  }
}

// ----------------------------------------------------------------
// useSendMessage — handles sending replies
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
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            phone_number: phoneNumber,
            message: message.trim(),
            media_url: mediaUrl,
            media_type: mediaType,
          }),
        })

        return res.ok
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
// useToggleAI — handles the AI/human takeover toggle
// ----------------------------------------------------------------
export function useToggleAI() {
  const toggleAI = useCallback(
    async (conversationId: string, aiMode: boolean) => {
      await fetch('/api/takeover', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          ai_mode: aiMode,
        }),
      })
    },
    []
  )

  return { toggleAI }
}
