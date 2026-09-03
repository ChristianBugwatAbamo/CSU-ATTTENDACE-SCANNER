-- ==============================================================================
-- CSU ROTC ATTENDANCE & ROSTER SYSTEM - SUPABASE DATABASE MIGRATION
-- Migration: Add unit_structure and administrative columns to system_settings
-- Instructions: Run this in your Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Paste & Click Run)
-- ==============================================================================

-- 1. CRITICAL FIX: Add JSONB column to hold dynamic Unit Echelons (Battalions, Companies, Platoons)
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS unit_structure JSONB DEFAULT '[]'::jsonb;

-- 2. Ensure all other system settings columns from master schema are present
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS total_unit_target INTEGER DEFAULT 1184,
ADD COLUMN IF NOT EXISTS excel_export_path TEXT DEFAULT './desktop_excel_reports/',
ADD COLUMN IF NOT EXISTS letterhead_config JSONB,
ADD COLUMN IF NOT EXISTS letterhead_html TEXT,
ADD COLUMN IF NOT EXISTS office_symbol VARCHAR(100) DEFAULT 'CSUROTCU1',
ADD COLUMN IF NOT EXISTS left_logo_url TEXT DEFAULT '/csug-logo.png',
ADD COLUMN IF NOT EXISTS right_logo_url TEXT DEFAULT '/rotc-seal-transparent.png',
ADD COLUMN IF NOT EXISTS auto_excel_export BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS id_signatory_name VARCHAR(255) DEFAULT 'COL CHARIS J ABAMO INF (GSC) PA',
ADD COLUMN IF NOT EXISTS id_signatory_title VARCHAR(255) DEFAULT 'Commandant, CSU ROTC Unit',
ADD COLUMN IF NOT EXISTS id_signature_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS id_card_orientation VARCHAR(20) DEFAULT 'vertical',
ADD COLUMN IF NOT EXISTS officer_ranks_list JSONB,
ADD COLUMN IF NOT EXISTS officer_roles_list JSONB;

-- 3. SYNC EXISTING ROW (Binds id_signatory_name to commanding_officer)
UPDATE public.system_settings
SET id_signatory_name = commanding_officer,
    id_signatory_title = COALESCE(commanding_officer_title, 'Commandant, CSU ROTC Unit')
WHERE commanding_officer IS NOT NULL;

-- 4. CREATE AUTO-SYNC TRIGGER FUNCTION
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

DROP TRIGGER IF EXISTS trg_sync_commanding_officer ON public.system_settings;

CREATE TRIGGER trg_sync_commanding_officer
BEFORE INSERT OR UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.sync_commanding_officer_to_signatory();

-- 5. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
