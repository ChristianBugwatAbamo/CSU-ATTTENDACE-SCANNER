-- ==============================================================================
-- MIGRATION: 5 OFFICIAL SEALS & LOGOS + SUPABASE STORAGE BUCKET
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Table: public.system_settings
-- Storage Bucket: branding-assets
-- ==============================================================================

-- 1. Add missing logo URL columns to system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS rcdg_seal_url TEXT DEFAULT '/rcdg-logo.png',
ADD COLUMN IF NOT EXISTS cdc_seal_url TEXT DEFAULT '/cdc-logo.png',
ADD COLUMN IF NOT EXISTS rotc_seal_url TEXT DEFAULT '/rotc-seal-transparent.png',
ADD COLUMN IF NOT EXISTS nstp_logo_url TEXT DEFAULT '/nstp-logo.png',
ADD COLUMN IF NOT EXISTS university_logo_url TEXT DEFAULT '/csu-logo.png';

-- 2. Backfill existing rows with fallback defaults if null
UPDATE public.system_settings
SET 
    rcdg_seal_url = COALESCE(rcdg_seal_url, '/rcdg-logo.png'),
    cdc_seal_url = COALESCE(cdc_seal_url, '/cdc-logo.png'),
    rotc_seal_url = COALESCE(rotc_seal_url, '/rotc-seal-transparent.png'),
    nstp_logo_url = COALESCE(nstp_logo_url, '/nstp-logo.png'),
    university_logo_url = COALESCE(university_logo_url, '/csu-logo.png')
WHERE id IS NOT NULL;

-- 3. Create 'branding-assets' storage bucket in Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Enable Public Read & Upload Access Policies on 'branding-assets'
DROP POLICY IF EXISTS "Public Read Access for Branding Assets" ON storage.objects;
CREATE POLICY "Public Read Access for Branding Assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'branding-assets');

DROP POLICY IF EXISTS "Public Upload Access for Branding Assets" ON storage.objects;
CREATE POLICY "Public Upload Access for Branding Assets"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'branding-assets');

DROP POLICY IF EXISTS "Public Update Access for Branding Assets" ON storage.objects;
CREATE POLICY "Public Update Access for Branding Assets"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'branding-assets');

DROP POLICY IF EXISTS "Public Delete Access for Branding Assets" ON storage.objects;
CREATE POLICY "Public Delete Access for Branding Assets"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'branding-assets');
