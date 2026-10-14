-- ==============================================================================
-- MIGRATION: UNIT SETTINGS & UNIT COMMAND PROFILE SYNCHRONIZATION
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Tables: public.unit_settings, public.system_settings
-- ==============================================================================

-- 1. Create public.unit_settings table if it does not exist
CREATE TABLE IF NOT EXISTS public.unit_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commandant VARCHAR(255) NOT NULL DEFAULT 'LTC CHRISTIAN B ABAMO INF (GSC) PA',
    unit_name VARCHAR(255) NOT NULL DEFAULT '1501st CDC ROTC Unit',
    school_name VARCHAR(255) NOT NULL DEFAULT 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)',
    cdc_name VARCHAR(255) NOT NULL DEFAULT '1501st Community Defense Center',
    rcdg_name VARCHAR(255) NOT NULL DEFAULT '15th Regional Community Defense Group (15RCDG)',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add columns to public.system_settings for seamless backward & forward compatibility
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS commandant VARCHAR(255) DEFAULT 'LTC CHRISTIAN B ABAMO INF (GSC) PA',
ADD COLUMN IF NOT EXISTS school_name VARCHAR(255) DEFAULT 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)',
ADD COLUMN IF NOT EXISTS cdc_name VARCHAR(255) DEFAULT '1501st Community Defense Center',
ADD COLUMN IF NOT EXISTS rcdg_name VARCHAR(255) DEFAULT '15th Regional Community Defense Group (15RCDG)';

-- Backfill system_settings new columns from existing values if available
UPDATE public.system_settings
SET 
    commandant = COALESCE(commandant, commanding_officer, 'LTC CHRISTIAN B ABAMO INF (GSC) PA'),
    school_name = COALESCE(school_name, host_institution, 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)'),
    cdc_name = COALESCE(cdc_name, '1501st Community Defense Center'),
    rcdg_name = COALESCE(rcdg_name, parent_command, '15th Regional Community Defense Group (15RCDG)')
WHERE id IS NOT NULL;

-- 3. Enable Row Level Security (RLS) on unit_settings
ALTER TABLE public.unit_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on unit_settings" ON public.unit_settings;
CREATE POLICY "Allow public read access on unit_settings"
    ON public.unit_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all operations on unit_settings" ON public.unit_settings;
CREATE POLICY "Allow all operations on unit_settings"
    ON public.unit_settings FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.unit_settings TO anon, authenticated, service_role;

-- 4. Seed initial default row in unit_settings if empty
INSERT INTO public.unit_settings (
    commandant,
    unit_name,
    school_name,
    cdc_name,
    rcdg_name
) 
SELECT 
    COALESCE(commandant, commanding_officer, 'LTC CHRISTIAN B ABAMO INF (GSC) PA'),
    COALESCE(unit_name, '1501st CDC ROTC Unit'),
    COALESCE(school_name, host_institution, 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)'),
    COALESCE(cdc_name, '1501st Community Defense Center'),
    COALESCE(rcdg_name, parent_command, '15th Regional Community Defense Group (15RCDG)')
FROM public.system_settings
LIMIT 1
ON CONFLICT DO NOTHING;

-- If system_settings had no rows, insert default
INSERT INTO public.unit_settings (
    commandant,
    unit_name,
    school_name,
    cdc_name,
    rcdg_name
)
SELECT 
    'LTC CHRISTIAN B ABAMO INF (GSC) PA',
    '1501st CDC ROTC Unit',
    'Caraga State University (CSU Main Campus, Ampayon, Butuan City)',
    '1501st Community Defense Center',
    '15th Regional Community Defense Group (15RCDG)'
WHERE NOT EXISTS (SELECT 1 FROM public.unit_settings);
