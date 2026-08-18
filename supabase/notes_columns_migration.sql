-- ============================================================
-- Notes Columns Migration
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

ALTER TABLE notes ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Note';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS title TEXT;
