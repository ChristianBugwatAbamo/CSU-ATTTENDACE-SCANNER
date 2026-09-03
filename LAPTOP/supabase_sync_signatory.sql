-- ==============================================================================
-- CSU ROTC ATTENDANCE & ROSTER SYSTEM - SUPABASE DATABASE MIGRATION
-- Feature: Automatic Synchronization of commanding_officer and id_signatory_name
-- Instructions: Run this in your Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Paste & Click Run)
-- ==============================================================================

-- 1. Ensure id_signatory_name and id_signatory_title columns exist in system_settings
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS id_signatory_name VARCHAR(255) DEFAULT 'COL CHARIS J ABAMO INF (GSC) PA',
ADD COLUMN IF NOT EXISTS id_signatory_title VARCHAR(255) DEFAULT 'Commandant, CSU ROTC Unit',
ADD COLUMN IF NOT EXISTS id_signature_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS id_card_orientation VARCHAR(20) DEFAULT 'vertical';

-- 2. SYNC EXISTING ROW IMMEDIATELY (Binds id_signatory_name to commanding_officer)
UPDATE public.system_settings
SET id_signatory_name = commanding_officer,
    id_signatory_title = COALESCE(commanding_officer_title, 'Commandant, CSU ROTC Unit')
WHERE commanding_officer IS NOT NULL;

-- 3. CREATE OR REPLACE AUTO-SYNC TRIGGER FUNCTION ON INSERT & UPDATE
CREATE OR REPLACE FUNCTION public.sync_commanding_officer_to_signatory()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id_signatory_name IS NULL OR NEW.id_signatory_name = '' THEN
      NEW.id_signatory_name := NEW.commanding_officer;
    END IF;
    IF NEW.id_signatory_title IS NULL OR NEW.id_signatory_title = '' THEN
      NEW.id_signatory_title := NEW.commanding_officer_title;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.commanding_officer IS DISTINCT FROM OLD.commanding_officer THEN
      NEW.id_signatory_name := NEW.commanding_officer;
    END IF;
    IF NEW.commanding_officer_title IS DISTINCT FROM OLD.commanding_officer_title THEN
      NEW.id_signatory_title := NEW.commanding_officer_title;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. ATTACH TRIGGER TO system_settings TABLE
DROP TRIGGER IF EXISTS trg_sync_commanding_officer ON public.system_settings;

CREATE TRIGGER trg_sync_commanding_officer
BEFORE INSERT OR UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_commanding_officer_to_signatory();

-- 5. RELOAD SCHEMA CACHE IMMEDIATELY
NOTIFY pgrst, 'reload schema';
