// ============================================================
// Type Definitions — WhatsApp Chat Dashboard
// ============================================================

export type Direction = 'incoming' | 'outgoing'

export type Stage =
  | 'new'
  | 'interested'
  | 'booking'
  | 'confirmed'
  | 'cancelled'
  | 'completed'

export interface Conversation {
  id: string
  phone_number: string
  name: string
  last_message: string | null
  unread_count: number
  ai_mode: boolean
  stage: Stage
  created_at: string
  updated_at: string
  lead?: Lead
  assigned_to?: string | null
assignment_status?: 'unassigned' | 'assigned' | 'completed' | 'closed'
assigned_user?: {
  id: string
  name: string
  email: string
} | null

}

export interface Message {
  id: string
  conversation_id: string
  phone_number: string
  message: string
  direction: Direction
  timestamp: string
  created_at: string
  media_url?: string | null    // ← add this
  media_type?: string | null   // ← add this

}

export interface Lead {
  id?: string
  conversation_id?: string
  phone_number: string
  name?: string
  lead_type?: string
  city?: string
  machine_interest?: string
  lead_quality?: string
  callback_ready?: string
  conversation_summary?: string
}
// n8n / Webhook payload
export interface WebhookPayload {
  phone_number: string
  name?: string
  message: string
  direction: Direction
  timestamp?: string
}

// Manual reply request
export interface ReplyPayload {
  conversation_id: string
  phone_number: string
  message: string
}

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: Conversation
        Insert: Partial<Conversation>
        Update: Partial<Conversation>
      }
      messages: {
        Row: Message
        Insert: Partial<Message>
        Update: Partial<Message>
      }
      leads: {
        Row: Lead
        Insert: Partial<Lead>
        Update: Partial<Lead>
      }
    }
  }
}
