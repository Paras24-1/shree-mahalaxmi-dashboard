-- ============================================================
-- WhatsApp Chat Dashboard - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number  TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT 'Unknown',
  last_message  TEXT,
  unread_count  INTEGER NOT NULL DEFAULT 0,
  ai_mode       BOOLEAN NOT NULL DEFAULT TRUE,
  stage         TEXT NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  phone_number    TEXT NOT NULL,
  message         TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: leads (hotel booking metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  phone_number    TEXT NOT NULL,
  name            TEXT,
  stage           TEXT NOT NULL DEFAULT 'new',
  checkin_date    DATE,
  checkout_date   DATE,
  room_type       TEXT,
  num_guests      INTEGER,
  budget          TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_phone ON conversations(phone_number);
CREATE INDEX idx_leads_conversation_id ON leads(conversation_id);

-- ============================================================
-- FUNCTION: auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: auto-upsert conversation & lead on new message
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert conversation
  INSERT INTO conversations (phone_number, name, last_message, unread_count, updated_at)
  VALUES (NEW.phone_number, NEW.phone_number, NEW.message, 
    CASE WHEN NEW.direction = 'incoming' THEN 1 ELSE 0 END, NOW())
  ON CONFLICT (phone_number) DO UPDATE SET
    last_message  = NEW.message,
    updated_at    = NOW(),
    unread_count  = CASE 
      WHEN NEW.direction = 'incoming' 
      THEN conversations.unread_count + 1 
      ELSE conversations.unread_count 
    END;

  -- Ensure lead record exists
  INSERT INTO leads (conversation_id, phone_number, name)
  SELECT id, phone_number, name FROM conversations WHERE phone_number = NEW.phone_number
  ON CONFLICT (conversation_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION handle_new_message();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow all operations for service_role (your backend)
CREATE POLICY "Service role full access - conversations"
  ON conversations FOR ALL USING (true);

CREATE POLICY "Service role full access - messages"
  ON messages FOR ALL USING (true);

CREATE POLICY "Service role full access - leads"
  ON leads FOR ALL USING (true);

-- ============================================================
-- REALTIME: Enable real-time on tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- ============================================================
-- SEED DATA (optional - for testing)
-- ============================================================
/*
INSERT INTO conversations (phone_number, name, last_message, stage, ai_mode)
VALUES 
  ('+919876543210', 'Rahul Sharma', 'What is the price of the deluxe room?', 'callback_done_by_ai', true),
  ('+919812345678', 'Priya Patel',  'I want to book for 2 nights',           'booking',    false),
  ('+919898989898', 'Amit Singh',   'Thank you for the confirmation!',        'confirmed',  true);

INSERT INTO messages (conversation_id, phone_number, message, direction, timestamp)
SELECT id, phone_number, 'Hello, I need help with my booking', 'incoming', NOW() - INTERVAL '1 hour'
FROM conversations WHERE phone_number = '+919876543210';
*/
