-- ============================================================
-- Task Kanban Migration
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

-- Drop old CHECK constraint on status (if it exists)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add new status CHECK with Kanban columns
ALTER TABLE tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('new', 'in_feedback', 'completed', 'rejected'));

-- Update default
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'new';

-- Migrate any old data
UPDATE tasks SET status = 'new' WHERE status = 'pending';

-- Add description column if missing
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT;

-- Add priority column if missing
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
