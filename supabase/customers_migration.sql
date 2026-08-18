-- ============================================================
-- Customers Table Migration
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              TEXT NOT NULL,
  phone_number      TEXT NOT NULL,
  email             TEXT,
  city              TEXT,
  company           TEXT,
  machine_interest  TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactive', 'favorite', 'duplicate')),
  is_favorite       BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access - customers" ON customers;
CREATE POLICY "Service role full access - customers" ON customers FOR ALL USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- Trigger
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
