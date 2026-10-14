-- ==============================================================================
-- MIGRATION: DYNAMIC HERO EMBLEMS JSONB ARRAY IN SYSTEM_SETTINGS
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Table: public.system_settings
-- ==============================================================================

-- 1. Add hero_emblems JSONB column to public.system_settings
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS hero_emblems JSONB DEFAULT '[
  {"id": "1", "label": "15th RCDG Seal", "url": "/rcdg-logo.png", "is_center": false, "active": true},
  {"id": "2", "label": "1501st CDC Seal", "url": "/cdc-logo.png", "is_center": false, "active": true},
  {"id": "3", "label": "Official ROTC Unit Seal (Center)", "url": "/rotc-seal-transparent.png", "is_center": true, "active": true},
  {"id": "4", "label": "NSTP Logo", "url": "/nstp-logo.png", "is_center": false, "active": true},
  {"id": "5", "label": "University / College Logo", "url": "/csu-logo.png", "is_center": false, "active": true}
]'::jsonb;

-- 2. Backfill existing system_settings rows where hero_emblems is null or empty
UPDATE public.system_settings
SET hero_emblems = jsonb_build_array(
  jsonb_build_object('id', '1', 'label', '15th RCDG Seal', 'url', COALESCE(rcdg_seal_url, '/rcdg-logo.png'), 'is_center', false, 'active', true),
  jsonb_build_object('id', '2', 'label', '1501st CDC Seal', 'url', COALESCE(cdc_seal_url, '/cdc-logo.png'), 'is_center', false, 'active', true),
  jsonb_build_object('id', '3', 'label', 'Official ROTC Unit Seal (Center)', 'url', COALESCE(rotc_seal_url, '/rotc-seal-transparent.png'), 'is_center', true, 'active', true),
  jsonb_build_object('id', '4', 'label', 'NSTP Logo', 'url', COALESCE(nstp_logo_url, '/nstp-logo.png'), 'is_center', false, 'active', true),
  jsonb_build_object('id', '5', 'label', 'University / College Logo', 'url', COALESCE(university_logo_url, '/csu-logo.png'), 'is_center', false, 'active', true)
)
WHERE hero_emblems IS NULL OR jsonb_array_length(hero_emblems) = 0;

-- 3. Ensure 'branding-assets' storage bucket exists for image file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-assets', 'branding-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Enable Public Storage Policies
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
