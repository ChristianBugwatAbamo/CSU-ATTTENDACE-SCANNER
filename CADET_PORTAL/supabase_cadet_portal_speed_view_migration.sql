-- ==============================================================================
-- CSU ROTC ATTENDANCE SYSTEM - CADET PORTAL PERFORMANCE & 3NF VIEW MIGRATION
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Tables: public.attendance_logs, public.cadets, public.platoons, public.academic_terms
-- Purpose:
--   1. Create idx_attendance_logs_cadet_term_status composite index for sub-second student dashboard loading.
--   2. Create vw_cadet_portal_summary view to resolve cadet, unit echelon, and term details via 3NF foreign keys.
--   3. Reload PostgREST schema cache.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Composite B-Tree Indexes for Sub-Second Cadet Attendance Dashboard Queries
-- ------------------------------------------------------------------------------

-- Composite index: cadet_id + academic_term_id + status
-- Allows index-only / bitmap index scans when cadets query their attendance history
CREATE INDEX IF NOT EXISTS idx_attendance_logs_cadet_term_status 
ON public.attendance_logs(cadet_id, academic_term_id, status);

-- Composite index: cadet_id + date DESC for fast timeline ordering
CREATE INDEX IF NOT EXISTS idx_attendance_logs_cadet_date 
ON public.attendance_logs(cadet_id, date DESC);

-- Composite index for excuse requests lookup
CREATE INDEX IF NOT EXISTS idx_excuse_requests_cadet_term_date 
ON public.excuse_requests(cadet_id, academic_term_id, drill_date DESC);

-- ------------------------------------------------------------------------------
-- STEP 2: Read-Optimized View: vw_cadet_portal_summary
-- Resolves unit echelon (battalion, company, platoon) dynamically via cadet_id & academic_term_id
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vw_cadet_portal_summary AS
SELECT 
    l.id,
    l.session_id,
    l.cadet_id,
    l.date,
    l.time_in,
    l.time_out,
    l.timestamp,
    l.scan_mode,
    l.time_in_status,
    l.time_out_status,
    l.status,
    l.final_daily_status,
    l.duty_officer,
    l.session_name,
    l.scanned_by,
    l.device_node,
    l.received_at,
    l.excuse_reason,
    l.excuse_proof_url,
    l.excuse_submitted_at,
    l.academic_term_id,
    l.created_at,
    l.updated_at,
    -- Cadet Profile Details (via cadet_id)
    c.name,
    c.rank,
    c.designation,
    c.type AS cadet_type,
    c.rotc_subject,
    c.is_active,
    -- Echelon Details (resolved dynamically via platoons)
    COALESCE(p.battalion, '1st Battalion') AS battalion,
    COALESCE(p.company, 'Alpha Company') AS company,
    COALESCE(p.name, '1st Platoon') AS platoon,
    COALESCE(p.battalion, '1st Battalion') AS battalion_name,
    COALESCE(p.company, 'Alpha Company') AS company_name,
    COALESCE(p.name, '1st Platoon') AS platoon_name,
    p.code AS platoon_code,
    -- Academic Course & Department Details
    COALESCE(crs.code, c.program, 'BSIT') AS course,
    COALESCE(crs.department, 'CCIS') AS department,
    crs.title AS course_title,
    -- Academic Term Details
    t.academic_year,
    t.semester,
    t.status AS term_status,
    (t.status = 'current') AS is_current_term
FROM public.attendance_logs l
JOIN public.cadets c ON l.cadet_id = c.id
LEFT JOIN public.platoons p ON c.platoon_id = p.id
LEFT JOIN public.academic_courses crs ON c.course_id = crs.id
LEFT JOIN public.academic_terms t ON l.academic_term_id = t.id;

-- ------------------------------------------------------------------------------
-- STEP 3: Grant Access Permissions to Supabase Roles
-- ------------------------------------------------------------------------------

GRANT SELECT ON public.vw_cadet_portal_summary TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- STEP 4: Reload PostgREST Schema Cache
-- ------------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
