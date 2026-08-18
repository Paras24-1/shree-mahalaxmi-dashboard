-- ============================================================
-- Lead CRM - New Columns
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;
