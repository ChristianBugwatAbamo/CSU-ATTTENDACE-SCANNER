-- ==============================================================================
-- MIGRATION: RENAME & EXPAND BRANDING COLUMNS IN system_settings
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Table: public.system_settings
-- ==============================================================================

DO $$
BEGIN
    -- 1. Rename host_institution -> school_name if host_institution exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'host_institution'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'school_name'
    ) THEN
        ALTER TABLE public.system_settings RENAME COLUMN host_institution TO school_name;
    END IF;

    -- If school_name still doesn't exist, create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'school_name'
    ) THEN
        ALTER TABLE public.system_settings ADD COLUMN school_name VARCHAR(255) DEFAULT 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)';
    END IF;

    -- 2. Rename parent_command -> rcdg_name if parent_command exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'parent_command'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'rcdg_name'
    ) THEN
        ALTER TABLE public.system_settings RENAME COLUMN parent_command TO rcdg_name;
    END IF;

    -- If rcdg_name still doesn't exist, create it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'rcdg_name'
    ) THEN
        ALTER TABLE public.system_settings ADD COLUMN rcdg_name VARCHAR(255) DEFAULT '15th Regional Community Defense Group (15RCDG)';
    END IF;

    -- 3. Add cdc_name column if it does not exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'cdc_name'
    ) THEN
        ALTER TABLE public.system_settings ADD COLUMN cdc_name VARCHAR(255) DEFAULT '1501st Community Defense Center';
    END IF;

    -- 4. Add commandant column if it does not exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'system_settings' 
          AND column_name = 'commandant'
    ) THEN
        ALTER TABLE public.system_settings ADD COLUMN commandant VARCHAR(255) DEFAULT 'LTC CHRISTIAN B ABAMO INF (GSC) PA';
        -- Backfill from commanding_officer if present
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'system_settings' 
              AND column_name = 'commanding_officer'
        ) THEN
            UPDATE public.system_settings SET commandant = commanding_officer WHERE commandant IS NULL;
        END IF;
    END IF;
END $$;

-- 5. Backfill any NULL values with standard CSU ROTC defaults
UPDATE public.system_settings
SET
    school_name = COALESCE(school_name, 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)'),
    rcdg_name = COALESCE(rcdg_name, '15th Regional Community Defense Group (15RCDG)'),
    cdc_name = COALESCE(cdc_name, '1501st Community Defense Center'),
    commandant = COALESCE(commandant, 'LTC CHRISTIAN B ABAMO INF (GSC) PA')
WHERE id IS NOT NULL;

-- 6. Reload schema cache for Supabase PostgREST
NOTIFY pgrst, 'reload schema';
