-- ==============================================================================
-- MIGRATION: ACADEMIC TERM COMMAND PROFILES & DYNAMIC SCOPING
-- Description: Adds command personnel columns to academic_terms and
--              term_command_profiles JSONB to system_settings so command
--              profiles can be tracked historically per academic term/year.
-- ==============================================================================

-- 1. Upgrade academic_terms table with optional command profile columns
ALTER TABLE public.academic_terms
    ADD COLUMN IF NOT EXISTS commandant VARCHAR(255),
    ADD COLUMN IF NOT EXISTS commanding_officer VARCHAR(255),
    ADD COLUMN IF NOT EXISTS commanding_officer_title VARCHAR(255) DEFAULT 'Commandant, CSU ROTC Unit',
    ADD COLUMN IF NOT EXISTS unit_name VARCHAR(255) DEFAULT '1501st CDC ROTC Unit',
    ADD COLUMN IF NOT EXISTS school_name VARCHAR(255) DEFAULT 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)',
    ADD COLUMN IF NOT EXISTS cdc_name VARCHAR(255) DEFAULT '1501st Community Defense Center',
    ADD COLUMN IF NOT EXISTS rcdg_name VARCHAR(255) DEFAULT '15th Regional Community Defense Group (15RCDG)',
    ADD COLUMN IF NOT EXISTS command_profile JSONB;

-- 2. Upgrade system_settings to store historical per-term command profiles dictionary
ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS term_command_profiles JSONB DEFAULT '{}'::jsonb;

-- 3. Populate default command profile on existing current/archived terms if missing
UPDATE public.academic_terms t
SET 
    commandant = COALESCE(t.commandant, s.commandant, s.commanding_officer, 'LTC CHRISTIAN B ABAMO INF (GSC) PA'),
    commanding_officer = COALESCE(t.commanding_officer, s.commanding_officer, s.commandant, 'LTC CHRISTIAN B ABAMO INF (GSC) PA'),
    commanding_officer_title = COALESCE(t.commanding_officer_title, s.commanding_officer_title, 'Commandant, CSU ROTC Unit'),
    unit_name = COALESCE(t.unit_name, s.unit_name, '1501st CDC ROTC Unit'),
    school_name = COALESCE(t.school_name, s.school_name, s.host_institution, 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)'),
    cdc_name = COALESCE(t.cdc_name, s.cdc_name, '1501st Community Defense Center'),
    rcdg_name = COALESCE(t.rcdg_name, s.rcdg_name, s.parent_command, '15th Regional Community Defense Group (15RCDG)')
FROM (
    SELECT commandant, commanding_officer, commanding_officer_title, unit_name, school_name, host_institution, cdc_name, rcdg_name, parent_command
    FROM public.system_settings
    ORDER BY created_at ASC
    LIMIT 1
) s
WHERE t.commandant IS NULL;
