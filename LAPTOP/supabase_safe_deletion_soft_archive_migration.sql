-- ==============================================================================
-- CSU ROTC ATTENDANCE SYSTEM - SAFE UNIT DELETION & SOFT-ARCHIVE MIGRATION
-- Target Database: PostgreSQL 15+ / Supabase
-- Description: Adds is_archived soft-delete support to unit tables and echelons,
--              preventing broken attendance records, foreign key constraint errors,
--              and orphaned cadet records.
-- ==============================================================================

-- 1. Ensure system_settings has unit_structure JSONB column
ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS unit_structure JSONB DEFAULT '[]'::jsonb;

-- 2. CREATE TABLE: battalions (with is_archived soft-delete support)
CREATE TABLE IF NOT EXISTS public.battalions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    short_code VARCHAR(20),
    target_quota INTEGER NOT NULL DEFAULT 296,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure column exists if table was already created
ALTER TABLE public.battalions 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.battalions 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_battalions_is_archived ON public.battalions(is_archived);

-- 3. CREATE TABLE: companies (with is_archived soft-delete support)
CREATE TABLE IF NOT EXISTS public.companies (
    id VARCHAR(50) PRIMARY KEY,
    battalion_id VARCHAR(50) REFERENCES public.battalions(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    short_code VARCHAR(20),
    target_quota INTEGER NOT NULL DEFAULT 148,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_battalion_company UNIQUE (battalion_id, name)
);

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_is_archived ON public.companies(is_archived);
CREATE INDEX IF NOT EXISTS idx_companies_battalion ON public.companies(battalion_id);

-- 4. CREATE TABLE: platoons (with is_archived soft-delete support)
CREATE TABLE IF NOT EXISTS public.platoons (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) REFERENCES public.companies(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    short_code VARCHAR(20),
    target_quota INTEGER NOT NULL DEFAULT 74,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_platoon UNIQUE (company_id, name)
);

ALTER TABLE public.platoons 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.platoons 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_platoons_is_archived ON public.platoons(is_archived);
CREATE INDEX IF NOT EXISTS idx_platoons_company ON public.platoons(company_id);

-- 5. Seed standard initial echelons if empty
INSERT INTO public.battalions (id, name, short_code, target_quota, is_archived)
VALUES 
    ('bn-1', '1st Battalion', '1BN', 296, false),
    ('bn-2', '2nd Battalion', '2BN', 296, false),
    ('bn-3', '3rd Battalion', '3BN', 296, false),
    ('bn-hq', 'Headquarters Battalion', 'HQBN', 296, false)
ON CONFLICT (id) DO UPDATE SET is_archived = false;

INSERT INTO public.companies (id, battalion_id, name, short_code, target_quota, is_archived)
VALUES 
    ('co-1-alpha', 'bn-1', 'Alpha Company', 'A-COY', 148, false),
    ('co-1-bravo', 'bn-1', 'Bravo Company', 'B-COY', 148, false),
    ('co-2-charlie', 'bn-2', 'Charlie Company', 'C-COY', 148, false),
    ('co-2-delta', 'bn-2', 'Delta Company', 'D-COY', 148, false),
    ('co-3-echo', 'bn-3', 'Echo Company', 'E-COY', 148, false),
    ('co-3-foxtrot', 'bn-3', 'Foxtrot Company', 'F-COY', 148, false),
    ('co-hq-hsc', 'bn-hq', 'Headquarters & Service Company', 'HSC-COY', 148, false),
    ('co-hq-medic', 'bn-hq', 'Medical & Logistics Support Company', 'MED-COY', 148, false)
ON CONFLICT (id) DO UPDATE SET is_archived = false;

-- 6. Helper View: Active Operational Echelons (Excluding Soft-Archived Units)
CREATE OR REPLACE VIEW public.view_active_echelons AS
SELECT 
    b.id AS battalion_id,
    b.name AS battalion_name,
    c.id AS company_id,
    c.name AS company_name,
    p.id AS platoon_id,
    p.name AS platoon_name
FROM public.battalions b
LEFT JOIN public.companies c ON c.battalion_id = b.id AND c.is_archived = false
LEFT JOIN public.platoons p ON p.company_id = c.id AND p.is_archived = false
WHERE b.is_archived = false;

-- 7. Grant public permissions for Supabase anon / authenticated roles
GRANT SELECT, INSERT, UPDATE ON public.battalions TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.companies TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.platoons TO anon, authenticated, service_role;
GRANT SELECT ON public.view_active_echelons TO anon, authenticated, service_role;
