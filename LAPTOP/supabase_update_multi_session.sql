-- ==============================================================================
-- SUPABASE MIGRATION: Multi-Session Rows per Duty Officer Batch
-- ==============================================================================
-- Removes single-column unique constraint on session_date in attendance_sessions,
-- and replaces it with a composite unique index on (session_date, duty_officer).
-- This enables separate session rows for each Duty Officer's smartphone batch on the same date.
-- ==============================================================================

-- 1. Remove single-column unique constraint on session_date if present
ALTER TABLE public.attendance_sessions 
DROP CONSTRAINT IF EXISTS attendance_sessions_session_date_key;

-- 2. Drop any legacy composite constraint if present
ALTER TABLE public.attendance_sessions 
DROP CONSTRAINT IF EXISTS attendance_sessions_session_date_duty_officer_key;

-- 3. Create composite unique index on (session_date, duty_officer)
CREATE UNIQUE INDEX IF NOT EXISTS session_date_duty_officer_idx 
ON public.attendance_sessions (session_date, duty_officer);

-- 4. Add optional session_id column to attendance_logs referencing attendance_sessions
ALTER TABLE public.attendance_logs 
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_logs_session_id 
ON public.attendance_logs(session_id);

-- Verify structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'attendance_sessions'
ORDER BY ordinal_position;
