-- ============================================================
-- WhatsApp Chat Dashboard - Supabase CRM Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add dynamic metadata JSONB column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add lead_type, lead_quality, and lead_score to leads table if they don't exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_quality TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;

-- 2. Create dealers table to replace Google Sheets
CREATE TABLE IF NOT EXISTS dealers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        TEXT NOT NULL,
  retailer_name TEXT NOT NULL,
  mobile_number TEXT,
  place         TEXT,
  taluka        TEXT,
  district      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dealers_org_id ON dealers(org_id);
CREATE INDEX IF NOT EXISTS idx_dealers_district ON dealers(district);
CREATE INDEX IF NOT EXISTS idx_dealers_taluka ON dealers(taluka);

-- 3. Create products table to replace Google Sheets
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        TEXT NOT NULL,
  model_name    TEXT NOT NULL,
  category      TEXT,
  pack_size     TEXT,
  image_id      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_org_id ON products(org_id);
CREATE INDEX IF NOT EXISTS idx_products_model ON products(model_name);

-- 4. Enable Realtime on new tables (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE dealers;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
