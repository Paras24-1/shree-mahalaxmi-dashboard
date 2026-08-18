-- ============================================================
-- Calendar Events Migration
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

-- Drop old CHECK constraint on type (if it exists)
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_type_check;

-- Add updated type CHECK constraint with all calendar categories
ALTER TABLE schedules
  ADD CONSTRAINT schedules_type_check
  CHECK (type IN ('reminder', 'meeting', 'event', 'lead', 'holiday', 'service'));

-- Add optional description and location columns
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
