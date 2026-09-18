-- ==============================================================================
-- CSU ROTC ATTENDANCE SYSTEM - CASCADE DELETE FOREIGN KEY & ORPHAN LOG CLEANUP
-- Database: PostgreSQL 15+ / Supabase
-- Target Tables: public.attendance_sessions, public.attendance_logs, public.excuse_requests
-- ==============================================================================
-- Description:
-- 1. Updates foreign key on attendance_logs(session_id) to ON DELETE CASCADE.
-- 2. Adds an AFTER DELETE trigger on attendance_sessions to automatically cascade-delete
--    any child attendance_logs (matching session_id OR session_date) and excuse_requests.
-- 3. Purges all existing orphaned attendance_logs and excuse_requests where no corresponding
--    active session exists in attendance_sessions (e.g. Sept 12, 2026).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Add ON DELETE CASCADE Foreign Key on attendance_logs(session_id)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  -- Find and drop any existing foreign key on session_id
  FOR fk_name IN (
    SELECT tc.constraint_name
    FROM   information_schema.table_constraints tc
    JOIN   information_schema.key_column_usage kcu
      ON   tc.constraint_name = kcu.constraint_name
     AND   tc.table_schema = kcu.table_schema
    WHERE  tc.table_schema = 'public'
      AND  tc.table_name = 'attendance_logs'
      AND  tc.constraint_type = 'FOREIGN KEY'
      AND  kcu.column_name = 'session_id'
  ) LOOP
    EXECUTE 'ALTER TABLE public.attendance_logs DROP CONSTRAINT IF EXISTS ' || quote_ident(fk_name);
  END LOOP;
END;
$$;

-- Add updated Foreign Key constraint with ON DELETE CASCADE
ALTER TABLE public.attendance_logs
  ADD CONSTRAINT attendance_logs_session_id_fkey
  FOREIGN KEY (session_id)
  REFERENCES public.attendance_sessions(id)
  ON DELETE CASCADE;

-- ------------------------------------------------------------------------------
-- STEP 2: Trigger on attendance_sessions for Complete Cascade Protection
-- Covers cases where attendance_logs rows were created with session_id = NULL
-- (loosely linked by date), as well as excuse_requests linked by drill_date.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cascade_delete_session_records()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete child attendance_logs matching session_id or session_date
  DELETE FROM public.attendance_logs
  WHERE session_id = OLD.id
     OR (session_id IS NULL AND date = OLD.session_date);

  -- Delete child excuse_requests matching session_date
  DELETE FROM public.excuse_requests
  WHERE drill_date = OLD.session_date
     OR date = OLD.session_date;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cascade_delete_session_records ON public.attendance_sessions;
CREATE TRIGGER trg_cascade_delete_session_records
AFTER DELETE ON public.attendance_sessions
FOR EACH ROW
EXECUTE FUNCTION public.cascade_delete_session_records();

-- ------------------------------------------------------------------------------
-- STEP 3: Purge Existing Orphaned Attendance Logs & Excuse Requests
-- Immediately removes all logs and excuse records for deleted sessions (such as Sept 12)
-- ------------------------------------------------------------------------------
-- 3a. Delete attendance_logs that have no matching active session
DELETE FROM public.attendance_logs
WHERE date NOT IN (SELECT session_date FROM public.attendance_sessions)
   OR (session_id IS NOT NULL AND session_id NOT IN (SELECT id FROM public.attendance_sessions));

-- 3b. Delete excuse_requests that have no matching active session
DELETE FROM public.excuse_requests
WHERE drill_date NOT IN (SELECT session_date FROM public.attendance_sessions)
  AND (date IS NULL OR date NOT IN (SELECT session_date FROM public.attendance_sessions));

-- ------------------------------------------------------------------------------
-- STEP 4: Verification Queries
-- Run these queries to verify that foreign key constraint and trigger are active
-- ------------------------------------------------------------------------------
-- Verify Foreign Key
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'attendance_logs'
  AND kcu.column_name = 'session_id';

-- Verify Trigger
SELECT
  event_object_table,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'attendance_sessions'
  AND trigger_name = 'trg_cascade_delete_session_records';

-- Verify No Orphaned Logs Remain
SELECT
  al.date,
  COUNT(*) AS orphaned_log_count
FROM public.attendance_logs al
LEFT JOIN public.attendance_sessions s ON al.date = s.session_date
WHERE s.id IS NULL
GROUP BY al.date;
