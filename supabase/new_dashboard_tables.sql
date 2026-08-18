-- ============================================================
-- Dashboard Redesign - New Tables
-- Run this in Supabase SQL Editor (safe to re-run)
-- ============================================================

-- TABLE: tasks
CREATE TABLE IF NOT EXISTS tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  due_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE: todos
CREATE TABLE IF NOT EXISTS todos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE: notes
CREATE TABLE IF NOT EXISTS notes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content       TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT 'green',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- TABLE: schedules
CREATE TABLE IF NOT EXISTS schedules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          TEXT NOT NULL CHECK (type IN ('reminder', 'meeting', 'event')),
  title         TEXT NOT NULL,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ROW LEVEL SECURITY
ALTER TABLE tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating (makes script safe to re-run)
DROP POLICY IF EXISTS "Service role full access - tasks"     ON tasks;
DROP POLICY IF EXISTS "Service role full access - todos"     ON todos;
DROP POLICY IF EXISTS "Service role full access - notes"     ON notes;
DROP POLICY IF EXISTS "Service role full access - schedules" ON schedules;

-- Policies: allow all operations
CREATE POLICY "Service role full access - tasks"     ON tasks     FOR ALL USING (true);
CREATE POLICY "Service role full access - todos"     ON todos     FOR ALL USING (true);
CREATE POLICY "Service role full access - notes"     ON notes     FOR ALL USING (true);
CREATE POLICY "Service role full access - schedules" ON schedules FOR ALL USING (true);

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE todos;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers before recreating (makes script safe to re-run)
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
DROP TRIGGER IF EXISTS update_todos_updated_at ON todos;
DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
