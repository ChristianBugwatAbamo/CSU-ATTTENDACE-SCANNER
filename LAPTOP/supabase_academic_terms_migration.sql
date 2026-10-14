-- ==============================================================================
-- MIGRATION: ACADEMIC YEAR & SEMESTER MANAGEMENT (PER-SEM TERMS)
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Tables:    public.academic_terms (NEW)
--                   public.system_settings (+ current_term_id)
-- Target Functions: public.set_active_academic_term(uuid)
--
-- PREREQUISITE: supabase_admin_whitelist_migration.sql (provides public.is_admin())
--
-- Rules enforced by the database:
--   * One row per (academic_year, semester).
--   * At most ONE term can have status = 'current' (partial unique index).
--   * Admins may INSERT terms (never directly as 'current').
--   * Switching the active term ONLY happens through set_active_academic_term(),
--     which atomically re-labels every other term (older -> archived,
--     newer -> upcoming) and updates system_settings.current_term_id.
--   * Everyone can READ terms (scanner devices / cadet portal need the
--     current term); only active whitelisted admins can write.
--
-- This script is idempotent — safe to re-run.
-- ==============================================================================

-- 0. Fail fast if the admin whitelist migration has not been applied
DO $$
BEGIN
    IF to_regprocedure('public.is_admin()') IS NULL THEN
        RAISE EXCEPTION 'public.is_admin() not found. Run supabase_admin_whitelist_migration.sql first.';
    END IF;
END;
$$;

-- 1. TABLE: academic_terms
CREATE TABLE IF NOT EXISTS public.academic_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year TEXT NOT NULL
        CHECK (academic_year ~ '^AY [0-9]{4}-[0-9]{4}$'
               AND substring(academic_year FROM 9 FOR 4)::INT = substring(academic_year FROM 4 FOR 4)::INT + 1),
    semester TEXT NOT NULL
        CHECK (semester IN ('1st Semester', '2nd Semester')),
    course TEXT,
    status TEXT NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('current', 'upcoming', 'archived')),
    start_date DATE,
    end_date DATE,
    expected_training_days INTEGER NOT NULL DEFAULT 15
        CHECK (expected_training_days BETWEEN 1 AND 60),
    completed_training_days INTEGER NOT NULL DEFAULT 0
        CHECK (completed_training_days >= 0),
    enrolled_cadets INTEGER NOT NULL DEFAULT 0
        CHECK (enrolled_cadets >= 0),
    -- Chronological sort key: AY start year * 10 + semester number (e.g. 20261, 20262)
    term_order INTEGER GENERATED ALWAYS AS (
        substring(academic_year FROM 4 FOR 4)::INT * 10
        + CASE semester WHEN '1st Semester' THEN 1 ELSE 2 END
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_academic_terms_year_semester UNIQUE (academic_year, semester),
    CONSTRAINT chk_academic_terms_dates CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- Idempotent column upgrades if table was already created
ALTER TABLE public.academic_terms
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS end_date DATE,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Only one CURRENT term system-wide
CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_terms_single_current
    ON public.academic_terms ((true))
    WHERE status = 'current';

CREATE INDEX IF NOT EXISTS idx_academic_terms_order
    ON public.academic_terms (term_order DESC);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.academic_terms_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academic_terms_updated_at ON public.academic_terms;
CREATE TRIGGER trg_academic_terms_updated_at
    BEFORE UPDATE ON public.academic_terms
    FOR EACH ROW EXECUTE FUNCTION public.academic_terms_touch_updated_at();

-- 2. Link system_settings -> academic_terms
ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS current_term_id UUID
    REFERENCES public.academic_terms(id) ON DELETE SET NULL;

-- 2b. Link cadets -> academic_terms & add rotc_subject
ALTER TABLE public.cadets
    ADD COLUMN IF NOT EXISTS rotc_subject VARCHAR(20) DEFAULT 'MS1'
    CHECK (rotc_subject IN ('MS1', 'MS2', 'MS 1', 'MS 2'));

ALTER TABLE public.cadets
    ADD COLUMN IF NOT EXISTS academic_term_id UUID
    REFERENCES public.academic_terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cadets_academic_term_id ON public.cadets(academic_term_id);
CREATE INDEX IF NOT EXISTS idx_cadets_rotc_subject ON public.cadets(rotc_subject);

-- 3. ROW LEVEL SECURITY
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access on academic_terms" ON public.academic_terms;
CREATE POLICY "Public read access on academic_terms"
    ON public.academic_terms FOR SELECT
    USING (true);

-- Admins can create terms
DROP POLICY IF EXISTS "Admins can insert academic_terms" ON public.academic_terms;
CREATE POLICY "Admins can insert academic_terms"
    ON public.academic_terms FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- Admins can ONLY delete UPCOMING terms with 0 completed training days and 0 enrolled cadets.
-- Deletion is strictly BLOCKED for CURRENT or ARCHIVED terms to protect historical attendance integrity.
DROP POLICY IF EXISTS "Admins can delete upcoming academic_terms" ON public.academic_terms;
CREATE POLICY "Admins can delete upcoming academic_terms"
    ON public.academic_terms FOR DELETE
    TO authenticated
    USING (
        public.is_admin()
        AND status = 'upcoming'
        AND completed_training_days = 0
        AND enrolled_cadets = 0
    );

GRANT SELECT ON TABLE public.academic_terms TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.academic_terms TO authenticated;

-- 4. RPC: switch the active system term atomically
CREATE OR REPLACE FUNCTION public.set_active_academic_term(p_term_id UUID)
RETURNS SETOF public.academic_terms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_target_order INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active administrators can change the active academic term.'
            USING ERRCODE = '42501';
    END IF;

    SELECT term_order INTO v_target_order
    FROM public.academic_terms
    WHERE id = p_term_id
    FOR UPDATE;

    IF v_target_order IS NULL THEN
        RAISE EXCEPTION 'Academic term % not found.', p_term_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Step 1: deactivate every other term (older -> archived, newer -> upcoming).
    --         Done before promoting the target so the single-current index never trips.
    UPDATE public.academic_terms
    SET status = CASE WHEN term_order < v_target_order THEN 'archived' ELSE 'upcoming' END,
        is_active = false
    WHERE id <> p_term_id;

    -- Step 2: promote the target term
    UPDATE public.academic_terms
    SET status = 'current',
        is_active = true
    WHERE id = p_term_id;

    -- Step 3: mirror onto the system_settings singleton
    UPDATE public.system_settings
    SET current_term_id = p_term_id,
        updated_at = NOW();

    RETURN QUERY
        SELECT * FROM public.academic_terms ORDER BY term_order DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.set_active_academic_term(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_active_academic_term(UUID) TO authenticated;

-- 5. RPC: Delete UPCOMING term safely (Strict guard: blocks CURRENT or ARCHIVED terms)
CREATE OR REPLACE FUNCTION public.delete_academic_term(p_term_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_status TEXT;
    v_completed INTEGER;
    v_cadets INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active administrators can delete academic terms.'
            USING ERRCODE = '42501';
    END IF;

    SELECT status, completed_training_days, enrolled_cadets
    INTO v_status, v_completed, v_cadets
    FROM public.academic_terms
    WHERE id = p_term_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Academic term % not found.', p_term_id USING ERRCODE = 'P0002';
    END IF;

    IF v_status <> 'upcoming' OR v_completed > 0 OR v_cadets > 0 THEN
        RAISE EXCEPTION 'Deletion blocked: Only UPCOMING terms with 0 completed training days and 0 enrolled cadets can be deleted to protect historical attendance data integrity.'
            USING ERRCODE = '23503';
    END IF;

    DELETE FROM public.academic_terms WHERE id = p_term_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_academic_term(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_academic_term(UUID) TO authenticated;

-- 6. RPC: Automatic Real-Time Current Term Detection from System Date (CURRENT_DATE)
-- Rules:
--   If today >= start_date AND today <= end_date -> mark as CURRENT
--   If today > end_date -> mark as ARCHIVED
--   If today < start_date -> mark as UPCOMING
CREATE OR REPLACE FUNCTION public.sync_academic_term_statuses()
RETURNS SETOF public.academic_terms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_matched_term_id UUID;
BEGIN
    -- 1. Find if any term has date range covering today
    SELECT id INTO v_matched_term_id
    FROM public.academic_terms
    WHERE start_date IS NOT NULL AND end_date IS NOT NULL
      AND v_today >= start_date AND v_today <= end_date
    ORDER BY term_order DESC
    LIMIT 1;

    -- If a term matches today and isn't already active, make it active
    IF v_matched_term_id IS NOT NULL THEN
        PERFORM public.set_active_academic_term(v_matched_term_id);
    ELSE
        -- Archive terms whose end_date has expired
        UPDATE public.academic_terms
        SET status = 'archived'
        WHERE end_date IS NOT NULL AND v_today > end_date AND status <> 'archived';

        -- Demote terms whose start_date is in the future
        UPDATE public.academic_terms
        SET status = 'upcoming'
        WHERE start_date IS NOT NULL AND v_today < start_date AND status = 'current';
    END IF;

    RETURN QUERY
        SELECT * FROM public.academic_terms ORDER BY term_order DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_academic_term_statuses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_academic_term_statuses() TO authenticated;

-- 7. RPC: Create Academic Term with automatic active/current synchronization
CREATE OR REPLACE FUNCTION public.create_academic_term(
    p_academic_year TEXT,
    p_semester TEXT,
    p_course TEXT,
    p_expected_days INTEGER,
    p_start_date DATE,
    p_end_date DATE,
    p_status TEXT
)
RETURNS public.academic_terms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_new_row public.academic_terms;
    v_target_order INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only active administrators can create academic terms.'
            USING ERRCODE = '42501';
    END IF;

    v_target_order := substring(p_academic_year FROM 4 FOR 4)::INT * 10
                      + CASE p_semester WHEN '1st Semester' THEN 1 ELSE 2 END;

    -- If creating as 'current', demote all other terms first so single_current unique index never conflicts
    IF p_status = 'current' THEN
        UPDATE public.academic_terms
        SET status = CASE WHEN term_order < v_target_order THEN 'archived' ELSE 'upcoming' END,
            is_active = false
        WHERE status = 'current';
    END IF;

    INSERT INTO public.academic_terms (
        academic_year, semester, course, expected_training_days, start_date, end_date, status, is_active
    ) VALUES (
        p_academic_year, p_semester, p_course, p_expected_days, p_start_date, p_end_date, p_status, (p_status = 'current')
    )
    RETURNING * INTO v_new_row;

    -- Mirror onto system_settings if current
    IF p_status = 'current' THEN
        UPDATE public.system_settings
        SET current_term_id = v_new_row.id,
            updated_at = NOW();
    END IF;

    RETURN v_new_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_academic_term(TEXT, TEXT, TEXT, INTEGER, DATE, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_academic_term(TEXT, TEXT, TEXT, INTEGER, DATE, DATE, TEXT) TO authenticated;

-- 8. Refresh PostgREST schema cache so the new table/column/RPC are visible immediately
NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------------------------
-- SEED DATA: Bootstrap standard ROTC Academic Terms (AY 2025-2026 through AY 2026-2027)
-- ------------------------------------------------------------------------------
INSERT INTO public.academic_terms (
    academic_year, semester, course, status, is_active, start_date, end_date, expected_training_days, completed_training_days, enrolled_cadets
) VALUES
    ('AY 2025-2026', '1st Semester', 'ROTC 1 (MS 1)', 'archived', false, '2025-08-15', '2025-12-20', 15, 15, 348),
    ('AY 2025-2026', '2nd Semester', 'ROTC 2 (MS 2)', 'archived', false, '2026-01-15', '2026-05-30', 15, 15, 332),
    ('AY 2026-2027', '1st Semester', 'ROTC 1 (MS 1)', 'current',  true,  '2026-08-15', '2026-12-20', 15, 6, 412),
    ('AY 2026-2027', '2nd Semester', 'ROTC 2 (MS 2)', 'upcoming', false, '2027-01-15', '2027-05-30', 15, 0, 0)
ON CONFLICT (academic_year, semester) DO UPDATE SET
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    course = EXCLUDED.course,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active;

-- Link active term to system_settings singleton
UPDATE public.system_settings
SET current_term_id = (
    SELECT id FROM public.academic_terms WHERE status = 'current' LIMIT 1
)
WHERE id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 9. ONE-TIME MIGRATION: Link legacy unlinked cadets to current active term
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_active_term_id UUID;
    v_migrated_count INT;
BEGIN
    -- Ensure academic_term_id column exists on public.cadets with foreign key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'cadets' AND column_name = 'academic_term_id'
    ) THEN
        ALTER TABLE public.cadets 
        ADD COLUMN academic_term_id UUID REFERENCES public.academic_terms(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_cadets_academic_term_id ON public.cadets(academic_term_id);
    END IF;

    -- Retrieve the current active term ID
    SELECT id INTO v_active_term_id
    FROM public.academic_terms
    WHERE status = 'current' OR is_active = true
    ORDER BY term_order DESC
    LIMIT 1;

    IF v_active_term_id IS NOT NULL THEN
        -- Link all unlinked legacy cadets to the current active term
        UPDATE public.cadets
        SET academic_term_id = v_active_term_id
        WHERE academic_term_id IS NULL;

        GET DIAGNOSTICS v_migrated_count = ROW_COUNT;
        RAISE NOTICE 'Linked % legacy cadets to active academic term %', v_migrated_count, v_active_term_id;

        -- Recalculate and update enrolled_cadets count live for all academic terms
        UPDATE public.academic_terms t
        SET enrolled_cadets = (
            SELECT COUNT(*) FROM public.cadets c WHERE c.academic_term_id = t.id
        );
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. ATTENDANCE SESSIONS LINK & AUTO-SYNC COMPLETED TRAINING DAYS TRIGGER
-- ------------------------------------------------------------------------------
ALTER TABLE public.attendance_sessions
    ADD COLUMN IF NOT EXISTS academic_term_id UUID
    REFERENCES public.academic_terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_academic_term_id ON public.attendance_sessions(academic_term_id);

-- Auto-link existing attendance_sessions to appropriate academic terms
DO $$
DECLARE
    v_active_term_id UUID;
BEGIN
    SELECT id INTO v_active_term_id
    FROM public.academic_terms
    WHERE status = 'current' OR is_active = true
    LIMIT 1;

    -- Match by term date range
    UPDATE public.attendance_sessions s
    SET academic_term_id = t.id
    FROM public.academic_terms t
    WHERE s.academic_term_id IS NULL
      AND t.start_date IS NOT NULL
      AND t.end_date IS NOT NULL
      AND s.session_date >= t.start_date
      AND s.session_date <= t.end_date;

    -- Fallback: link remaining unlinked sessions to the active term
    IF v_active_term_id IS NOT NULL THEN
        UPDATE public.attendance_sessions
        SET academic_term_id = v_active_term_id
        WHERE academic_term_id IS NULL;
    END IF;

    -- Recalculate completed_training_days count live for all academic terms
    UPDATE public.academic_terms t
    SET completed_training_days = (
        SELECT COUNT(DISTINCT s.session_date)
        FROM public.attendance_sessions s
        WHERE s.academic_term_id = t.id
           OR (s.academic_term_id IS NULL AND t.start_date IS NOT NULL AND t.end_date IS NOT NULL AND s.session_date >= t.start_date AND s.session_date <= t.end_date)
    );
END;
$$;

-- Trigger Function: Keep academic_terms.completed_training_days in sync with attendance_sessions
CREATE OR REPLACE FUNCTION public.sync_academic_term_training_days()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_term_id UUID;
    v_date DATE;
BEGIN
    v_term_id := COALESCE(NEW.academic_term_id, OLD.academic_term_id);
    v_date := COALESCE(NEW.session_date, OLD.session_date);

    -- Auto-infer term if academic_term_id is null
    IF v_term_id IS NULL AND v_date IS NOT NULL THEN
        SELECT id INTO v_term_id
        FROM public.academic_terms
        WHERE v_date >= start_date AND v_date <= end_date
        ORDER BY term_order DESC
        LIMIT 1;

        IF v_term_id IS NULL THEN
            SELECT id INTO v_term_id
            FROM public.academic_terms
            WHERE status = 'current' OR is_active = true
            LIMIT 1;
        END IF;

        IF TG_OP = 'INSERT' AND NEW.academic_term_id IS NULL AND v_term_id IS NOT NULL THEN
            NEW.academic_term_id := v_term_id;
        END IF;
    END IF;

    IF v_term_id IS NOT NULL THEN
        UPDATE public.academic_terms
        SET completed_training_days = (
            SELECT COUNT(DISTINCT session_date)
            FROM public.attendance_sessions
            WHERE academic_term_id = v_term_id
               OR (academic_term_id IS NULL AND session_date >= start_date AND session_date <= end_date)
        )
        WHERE id = v_term_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_academic_term_training_days ON public.attendance_sessions;
CREATE TRIGGER trg_sync_academic_term_training_days
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.sync_academic_term_training_days();

NOTIFY pgrst, 'reload schema';


