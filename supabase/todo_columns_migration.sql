-- ============================================================
-- Todo Columns Migration
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

ALTER TABLE todos ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;
ALTER TABLE todos ADD COLUMN IF NOT EXISTS recurrence_interval TEXT DEFAULT 'none';
