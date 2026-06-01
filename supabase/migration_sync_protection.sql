-- ============================================================
-- WhatsApp Chat Dashboard - Sync Overwrite Protection
-- Run this in Supabase SQL Editor to protect 'stage' and 'notes'
-- ============================================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION protect_sync_data()
RETURNS TRIGGER AS $$
BEGIN
  -- If both stage is being set to 'new' (or NULL/empty) AND notes is being set to NULL/empty,
  -- we identify it as an automated background sync overwrite.
  -- In this case, we restore the existing non-empty values.
  IF (NEW.stage IS NULL OR NEW.stage = 'new' OR NEW.stage = '') AND
     (NEW.notes IS NULL OR NEW.notes = '') THEN
     
     -- Restore OLD stage if OLD stage was not 'new' or empty/null
     IF OLD.stage IS NOT NULL AND OLD.stage != 'new' AND OLD.stage != '' THEN
       NEW.stage := OLD.stage;
     END IF;
     
     -- Restore OLD notes if OLD notes was not empty/null
     IF OLD.notes IS NOT NULL AND OLD.notes != '' THEN
       NEW.notes := OLD.notes;
     END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply sync protection trigger to conversations table
DROP TRIGGER IF EXISTS trigger_protect_conversations_sync ON conversations;
CREATE TRIGGER trigger_protect_conversations_sync
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION protect_sync_data();

-- Apply sync protection trigger to leads table
DROP TRIGGER IF EXISTS trigger_protect_leads_sync ON leads;
CREATE TRIGGER trigger_protect_leads_sync
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION protect_sync_data();
