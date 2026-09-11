-- ==============================================================================
-- CSU ROTC EXCUSE WORKFLOW, RLS POLICIES & UNRECORDED FORMATION FIX MIGRATION
-- Database: PostgreSQL 15+ / Supabase
-- Target Tables: public.attendance_logs, public.system_settings, public.cadets, public.attendance_sessions
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- ------------------------------------------------------------------------------
-- STEP 1: Add Excuse Tracking Columns to attendance_logs
-- ------------------------------------------------------------------------------
ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS excuse_reason TEXT,
  ADD COLUMN IF NOT EXISTS excuse_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS excuse_submitted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.attendance_logs.excuse_reason IS 'Cadet-provided excuse statement filed via Cadet Portal';
COMMENT ON COLUMN public.attendance_logs.excuse_proof_url IS 'Optional proof attachment URL';
COMMENT ON COLUMN public.attendance_logs.excuse_submitted_at IS 'Timestamp when the excuse request was submitted online';

-- ------------------------------------------------------------------------------
-- STEP 2: Resolve Unrecorded Formation & Foreign Key Constraints
-- Ensure session_id and cadet profile fields do not block excuse insertion when
-- a formation session was not formally initialized by admin ahead of time.
-- ------------------------------------------------------------------------------
-- Allow session_id to be NULL for unrecorded / ad-hoc drill dates
ALTER TABLE public.attendance_logs
  ALTER COLUMN session_id DROP NOT NULL;

-- Allow name / rank / unit to have safe defaults if not provided in minimal payload
ALTER TABLE public.attendance_logs
  ALTER COLUMN name DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- STEP 3: Add Excuse Grace Period Column to system_settings
-- ------------------------------------------------------------------------------
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS excuse_grace_period_days INTEGER NOT NULL DEFAULT 3;

COMMENT ON COLUMN public.system_settings.excuse_grace_period_days IS 'Number of calendar days after formation date allowed for submitting excuse letters';

-- ------------------------------------------------------------------------------
-- STEP 4: Relax / Update Status Check Constraints on attendance_logs
-- Ensure EXCUSE_PENDING and EXCUSED statuses are permitted without constraint violation.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop any existing CHECK constraints on "status" or "final_daily_status"
  FOR r IN (
    SELECT tc.constraint_name
    FROM   information_schema.table_constraints tc
    JOIN   information_schema.check_constraints cc
      ON   tc.constraint_name = cc.constraint_name
    WHERE  tc.table_schema = 'public'
      AND  tc.table_name = 'attendance_logs'
      AND  tc.constraint_type = 'CHECK'
      AND  (tc.constraint_name ILIKE '%status%' OR cc.check_clause ILIKE '%status%')
  ) LOOP
    EXECUTE 'ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;
END;
$$;

-- Add updated constraint covering all valid muster and excuse states
ALTER TABLE public.attendance_logs
  ADD CONSTRAINT chk_attendance_logs_status
  CHECK (
    status IN (
      'PRESENT',
      'LATE',
      'NO TIME-IN',
      'NO TIME-OUT',
      'LATE / NO TIME-OUT',
      'ABSENT',
      'EXCUSE_PENDING',
      'EXCUSED'
    )
  );

-- ------------------------------------------------------------------------------
-- STEP 5: Fix Row Level Security (RLS) & Grant Permissions
-- Ensure anon and authenticated cadet roles have full permission to SELECT, INSERT,
-- and UPDATE excuse requests in attendance_logs without permission errors.
-- ------------------------------------------------------------------------------
-- Enable RLS
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

-- Grant standard PostgreSQL table permissions to anon and authenticated roles
GRANT ALL ON TABLE public.attendance_logs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.system_settings TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.cadets TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.attendance_sessions TO anon, authenticated, service_role;

-- Drop any conflicting or restrictive policies
DROP POLICY IF EXISTS "Allow public read access on attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow all operations on attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow cadet excuse submission" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow public insert attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow public update attendance_logs" ON public.attendance_logs;

-- Permissive policy for attendance_logs (allows cadet portal insert/update & admin management)
CREATE POLICY "Allow all operations on attendance_logs"
  ON public.attendance_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Permissive policy for system_settings
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON public.system_settings;
CREATE POLICY "Allow all operations on system_settings"
  ON public.system_settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Permissive policy for cadets (profile read & lookups)
DROP POLICY IF EXISTS "Allow all operations on cadets" ON public.cadets;
CREATE POLICY "Allow all operations on cadets"
  ON public.cadets
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Permissive policy for attendance_sessions
DROP POLICY IF EXISTS "Allow all operations on attendance_sessions" ON public.attendance_sessions;
CREATE POLICY "Allow all operations on attendance_sessions"
  ON public.attendance_sessions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- STEP 6: Performance Indexes for Faster Excuse Queue Queries
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attendance_logs_excuse_queue
  ON public.attendance_logs (status, date DESC)
  WHERE status IN ('EXCUSE_PENDING', 'EXCUSED');

CREATE INDEX IF NOT EXISTS idx_attendance_logs_cadet_date_status
  ON public.attendance_logs (cadet_id, date, status);

-- ------------------------------------------------------------------------------
-- STEP 7: Automated Grace Period Expiration Helper Routine
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_pending_excuse_requests()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_grace_days INTEGER := 3;
  v_rows_updated INTEGER := 0;
BEGIN
  SELECT COALESCE(excuse_grace_period_days, 3)
  INTO   v_grace_days
  FROM   public.system_settings
  ORDER  BY updated_at DESC
  LIMIT  1;

  IF v_grace_days IS NULL THEN
    v_grace_days := 3;
  END IF;

  UPDATE public.attendance_logs
  SET    status = 'ABSENT',
         final_daily_status = 'ABSENT',
         updated_at = NOW()
  WHERE  status = 'EXCUSE_PENDING'
    AND  date + (v_grace_days * INTERVAL '1 day') < CURRENT_DATE;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  RETURN v_rows_updated;
END;
$$;

COMMENT ON FUNCTION public.expire_pending_excuse_requests() IS 'Routine to auto-expire EXCUSE_PENDING records that exceeded the grace period';

-- ------------------------------------------------------------------------------
-- STEP 8: Create public.excuse_requests Table (Unified Table Support)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.excuse_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cadet_id TEXT NOT NULL,
  drill_date DATE NOT NULL,
  date DATE,
  reason TEXT,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXCUSED', 'ABSENT')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_cadet_drill_date UNIQUE (cadet_id, drill_date)
);

ALTER TABLE public.excuse_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.excuse_requests TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Allow all operations on excuse_requests" ON public.excuse_requests;
CREATE POLICY "Allow all operations on excuse_requests"
  ON public.excuse_requests
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- STEP 9: SQL Query & View to Pull Cadets Without Excuses / Declared Absent
-- Pulls cadets who either:
-- 1. Have an attendance record marked as ABSENT (e.g. excuse rejected or grace period expired)
-- 2. Were enrolled during an official formation session date but have NO scan and NO excuse filed
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_cadets_declared_absent AS
SELECT 
  c.id AS cadet_id,
  c.name AS cadet_name,
  c.rank,
  c.battalion,
  c.company,
  c.platoon,
  s.session_date AS drill_date,
  COALESCE(al.status, 'ABSENT') AS status,
  COALESCE(al.excuse_reason, 'Unexcused Absence (Did Not Attend Formation)') AS reason,
  al.id AS log_id,
  al.created_at AS recorded_at
FROM public.cadets c
CROSS JOIN public.attendance_sessions s
LEFT JOIN public.attendance_logs al 
  ON (al.cadet_id = c.id OR al.cadet_id = REPLACE(c.id, '-', '')) 
  AND al.date = s.session_date
WHERE (al.id IS NULL OR al.status = 'ABSENT' OR al.final_daily_status = 'ABSENT')
  AND (al.status IS NULL OR al.status NOT IN ('PRESENT', 'LATE', 'EXCUSED', 'EXCUSE_PENDING'))
ORDER BY s.session_date DESC, c.name ASC;

COMMENT ON VIEW public.v_cadets_declared_absent IS 'View showing cadets without excuses or marked ABSENT across all formation dates';

-- ------------------------------------------------------------------------------
-- Verification Query: Confirm Setup
-- ------------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_name = 'attendance_logs'
  AND tc.constraint_name = 'chk_attendance_logs_status';

