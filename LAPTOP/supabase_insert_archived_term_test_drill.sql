-- ==============================================================================
-- CSU ROTC ATTENDANCE SYSTEM - SEED TEST DRILL & ATTENDANCE FOR ARCHIVED TERM
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Tables: public.attendance_sessions, public.attendance_logs
-- Term: AY 2025-2026 2nd Semester (ec4a35e1-c5c8-424c-bd0d-e1e5745babd2)
-- Cadet: QWEDAS, ASASD A. (123-12321)
-- ==============================================================================

DO $$
DECLARE
    v_term_id UUID := 'ec4a35e1-c5c8-424c-bd0d-e1e5745babd2'; -- AY 2025-2026 2nd Semester
    v_cadet_id VARCHAR(30) := '123-12321';                      -- Cadet QWEDAS, ASASD A.
    v_session_id UUID;
    v_session_date DATE := '2026-02-14';
    v_officer VARCHAR(255) := 'Duty Officer';
    v_session_name VARCHAR(255) := 'Training Formation (AY 2025-2026 2nd Sem - Drill 1)';
BEGIN
    -- 1. Ensure target academic term exists
    IF NOT EXISTS (SELECT 1 FROM public.academic_terms WHERE id = v_term_id) THEN
        RAISE EXCEPTION 'Academic term % does not exist in public.academic_terms', v_term_id;
    END IF;

    -- 2. Ensure Cadet QWEDAS exists and is assigned to this term
    UPDATE public.cadets
    SET academic_term_id = v_term_id
    WHERE id = v_cadet_id;

    -- 3. Upsert Formation Session for 2026-02-14 under AY 2025-2026 2nd Semester
    SELECT id INTO v_session_id
    FROM public.attendance_sessions
    WHERE session_date = v_session_date AND duty_officer = v_officer;

    IF v_session_id IS NULL THEN
        INSERT INTO public.attendance_sessions (
            id,
            session_date,
            session_name,
            duty_officer,
            cutoff_time,
            total_scanned,
            present_count,
            late_count,
            absent_count,
            is_locked,
            academic_term_id
        )
        VALUES (
            gen_random_uuid(),
            v_session_date,
            v_session_name,
            v_officer,
            '07:30',
            1,
            1,
            0,
            0,
            false,
            v_term_id
        )
        RETURNING id INTO v_session_id;
    ELSE
        UPDATE public.attendance_sessions
        SET academic_term_id = v_term_id,
            session_name = v_session_name,
            total_scanned = 1,
            present_count = 1,
            late_count = 0,
            absent_count = 0
        WHERE id = v_session_id;
    END IF;

    -- 4. Upsert Attendance Log for Cadet QWEDAS (3NF Transactional Metadata)
    INSERT INTO public.attendance_logs (
        session_id,
        cadet_id,
        date,
        time_in,
        time_out,
        timestamp,
        scan_mode,
        time_in_status,
        time_out_status,
        status,
        final_daily_status,
        duty_officer,
        session_name,
        academic_term_id
    )
    VALUES (
        v_session_id,
        v_cadet_id,
        v_session_date,
        ('2026-02-14 06:45:00+08')::TIMESTAMPTZ,
        ('2026-02-14 11:30:00+08')::TIMESTAMPTZ,
        ('2026-02-14 06:45:00+08')::TIMESTAMPTZ,
        'Time-Out',
        'PRESENT',
        'PRESENT',
        'PRESENT',
        'PRESENT',
        v_officer,
        v_session_name,
        v_term_id
    )
    ON CONFLICT (cadet_id, date) DO UPDATE SET
        session_id = EXCLUDED.session_id,
        time_in = EXCLUDED.time_in,
        time_out = EXCLUDED.time_out,
        timestamp = EXCLUDED.timestamp,
        scan_mode = EXCLUDED.scan_mode,
        time_in_status = EXCLUDED.time_in_status,
        time_out_status = EXCLUDED.time_out_status,
        status = EXCLUDED.status,
        final_daily_status = EXCLUDED.final_daily_status,
        duty_officer = EXCLUDED.duty_officer,
        session_name = EXCLUDED.session_name,
        academic_term_id = EXCLUDED.academic_term_id,
        updated_at = NOW();

    -- 5. Sync completed_training_days on academic_terms
    UPDATE public.academic_terms
    SET completed_training_days = (
        SELECT COUNT(DISTINCT session_date)
        FROM public.attendance_sessions
        WHERE academic_term_id = v_term_id
    )
    WHERE id = v_term_id;

    RAISE NOTICE 'Successfully seeded test formation session % and attendance log for Cadet % under Term %',
        v_session_date, v_cadet_id, v_term_id;
END $$;
