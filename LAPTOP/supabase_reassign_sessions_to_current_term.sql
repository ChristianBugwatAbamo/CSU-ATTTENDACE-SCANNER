-- ==============================================================================
-- RE-ASSIGN TEST DATA TO CURRENT ACTIVE TERM (AY 2026-2027 1st Semester)
-- Target Term ID: a71a8c59-a848-463f-a7f2-bb634501e3e3 (AY 2026-2027 1st Semester)
-- Previous Term ID: ec4a35e1-c5c8-424c-bd0d-e1e5745babd2 (AY 2025-2026 2nd Semester)
-- ==============================================================================

-- STEP 1: Ensure academic_term_id column exists on public.excuse_requests
ALTER TABLE public.excuse_requests 
ADD COLUMN IF NOT EXISTS academic_term_id UUID REFERENCES public.academic_terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_excuse_requests_term_id ON public.excuse_requests(academic_term_id);

-- STEP 2: Re-assign formation sessions (2026-09-23 and 2026-09-29) to AY 2026-2027 1st Sem
UPDATE public.attendance_sessions
SET academic_term_id = 'a71a8c59-a848-463f-a7f2-bb634501e3e3'
WHERE session_date IN ('2026-09-23', '2026-09-29');

-- STEP 3: Re-assign attendance logs for those dates to AY 2026-2027 1st Sem
UPDATE public.attendance_logs
SET academic_term_id = 'a71a8c59-a848-463f-a7f2-bb634501e3e3'
WHERE date IN ('2026-09-23', '2026-09-29');

-- STEP 4: Link all excuse_requests to their respective cadet's academic_term_id
UPDATE public.excuse_requests er
SET academic_term_id = c.academic_term_id
FROM public.cadets c
WHERE er.cadet_id = c.id;

-- Fallback explicitly for Cadet Trazares and Sep 2026 excuse records
UPDATE public.excuse_requests
SET academic_term_id = 'a71a8c59-a848-463f-a7f2-bb634501e3e3'
WHERE cadet_id = '221-00009' OR drill_date IN ('2026-09-23', '2026-09-29');

-- STEP 5: Recalculate completed training days count live for all academic terms
UPDATE public.academic_terms t
SET completed_training_days = (
    SELECT COUNT(DISTINCT s.session_date)
    FROM public.attendance_sessions s
    WHERE s.academic_term_id = t.id
);

-- ==============================================================================
-- VERIFICATION QUERY
-- ==============================================================================
SELECT 
    t.academic_year, 
    t.semester, 
    t.status, 
    t.completed_training_days,
    COUNT(DISTINCT s.session_date) AS live_sessions_count
FROM public.academic_terms t
LEFT JOIN public.attendance_sessions s ON s.academic_term_id = t.id
GROUP BY t.id, t.academic_year, t.semester, t.status, t.completed_training_days
ORDER BY t.academic_year DESC, t.semester ASC;
