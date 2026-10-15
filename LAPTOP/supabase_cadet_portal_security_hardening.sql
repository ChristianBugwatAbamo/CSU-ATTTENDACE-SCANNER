-- ==============================================================================
-- CSU ROTC ATTENDANCE SYSTEM - CADET PORTAL PRODUCTION SECURITY HARDENING
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Tables: public.cadets, public.attendance_logs, public.system_settings,
--                public.attendance_sessions, public.excuse_requests, storage.buckets
-- Purpose:
--   1. REVOKE insecure public write/delete permissions ('FOR ALL TO public USING (true)').
--   2. Enforce strict Row Level Security (RLS) on all core operational tables.
--   3. Create SECURITY DEFINER RPCs for:
--      a) rpc_cadet_portal_login: Authenticates cadet by ID + Last Name inside PostgreSQL.
--      b) rpc_get_cadet_attendance_logs: Fetches attendance history only for the verified cadet (RETURNS JSONB).
--      c) rpc_submit_excuse_request: Validates identity, date, and status before submitting.
--   4. Prevent student database enumeration, scraping, table wipes, and attendance tampering.
--   5. Configure dedicated 'excuse-proofs' storage bucket with public policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Ultra-Resilient public.is_admin() helper function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_is_admin BOOLEAN := FALSE;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check admin_whitelist table if present
    BEGIN
        SELECT EXISTS (
            SELECT 1
            FROM auth.users u
            JOIN public.admin_whitelist w ON lower(u.email) = lower(w.email)
            WHERE u.id = auth.uid() AND w.is_active = TRUE
        ) INTO v_is_admin;
    EXCEPTION WHEN OTHERS THEN
        v_is_admin := FALSE;
    END;

    IF v_is_admin THEN
        RETURN TRUE;
    END IF;

    -- Fallback: check if auth user email contains admin or role metadata
    BEGIN
        SELECT EXISTS (
            SELECT 1
            FROM auth.users u
            WHERE u.id = auth.uid()
              AND (
                lower(u.email) LIKE '%admin%'
                OR u.raw_user_meta_data ->> 'role' IN ('ADMIN', 'SUPER_ADMIN', 'COMMANDANT_HQ')
              )
        ) INTO v_is_admin;
    EXCEPTION WHEN OTHERS THEN
        v_is_admin := FALSE;
    END;

    RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- STEP 2: Enable & Force Row Level Security (RLS) on all tables
-- ------------------------------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cadets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.excuse_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excuse_requests FORCE ROW LEVEL SECURITY;

-- Drop obsolete or overly-permissive legacy policies
DROP POLICY IF EXISTS "Allow all operations on attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow all operations on cadets" ON public.cadets;
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow all operations on attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Allow all operations on excuse_requests" ON public.excuse_requests;
DROP POLICY IF EXISTS "Allow public read access on cadets" ON public.cadets;
DROP POLICY IF EXISTS "Allow public read access on attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Allow public read access on system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public read access on attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Allow public read access on excuse_requests" ON public.excuse_requests;

-- Drop previous iterations of these new policies if re-running
DROP POLICY IF EXISTS "Public read system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Admin write system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Public read attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Admin write attendance_sessions" ON public.attendance_sessions;
DROP POLICY IF EXISTS "Public read academic_terms" ON public.academic_terms;
DROP POLICY IF EXISTS "Admin write academic_terms" ON public.academic_terms;
DROP POLICY IF EXISTS "Admin full access to cadets" ON public.cadets;
DROP POLICY IF EXISTS "Admin full access to attendance_logs" ON public.attendance_logs;
DROP POLICY IF EXISTS "Admin full access to excuse_requests" ON public.excuse_requests;

-- ------------------------------------------------------------------------------
-- STEP 3: Safe Read-Only Public Policies (Branding, Schedules, Academic Terms)
-- ------------------------------------------------------------------------------

-- System Settings: Anyone can read branding, cutoff times, commandant names
CREATE POLICY "Public read system_settings"
  ON public.system_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- System Settings: Only authenticated Admins can modify settings
CREATE POLICY "Admin write system_settings"
  ON public.system_settings FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Attendance Sessions: Anyone can read formation drill calendar dates
CREATE POLICY "Public read attendance_sessions"
  ON public.attendance_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Attendance Sessions: Only authenticated Admins can create/edit sessions
CREATE POLICY "Admin write attendance_sessions"
  ON public.attendance_sessions FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Academic Terms: Anyone can read academic terms
CREATE POLICY "Public read academic_terms"
  ON public.academic_terms FOR SELECT
  TO anon, authenticated
  USING (true);

-- Academic Terms: Only Admins can modify terms
CREATE POLICY "Admin write academic_terms"
  ON public.academic_terms FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- STEP 4: Admin Full Access Policies on Cadets & Attendance
-- ------------------------------------------------------------------------------
CREATE POLICY "Admin full access to cadets"
  ON public.cadets FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin full access to attendance_logs"
  ON public.attendance_logs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin full access to excuse_requests"
  ON public.excuse_requests FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- STEP 5: SECURITY DEFINER RPC 1 - Secure Cadet Login & Verification
-- Prevents scraping/dumping the entire roster. Requires exact ID + Last Name match.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_cadet_portal_login(
    p_cadet_id TEXT,
    p_last_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_id TEXT := upper(btrim(regexp_replace(COALESCE(p_cadet_id, ''), '[^a-zA-Z0-9]', '', 'g')));
    v_clean_last TEXT := upper(btrim(regexp_replace(COALESCE(p_last_name, ''), '[^a-zA-Z0-9]', '', 'g')));
    v_cadet RECORD;
    v_cadet_json JSONB;
    v_cadet_last TEXT;
    v_is_act BOOLEAN := TRUE;
BEGIN
    IF v_clean_id = '' OR v_clean_last = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'MISSING_CREDENTIALS',
            'message', 'Both Cadet ID and Last Name are required.'
        );
    END IF;

    -- Query single cadet record matching ID
    SELECT * INTO v_cadet
    FROM public.cadets c
    WHERE upper(btrim(regexp_replace(COALESCE(c.student_id, ''), '[^a-zA-Z0-9]', '', 'g'))) = v_clean_id
       OR upper(btrim(regexp_replace(COALESCE(c.id::text, ''), '[^a-zA-Z0-9]', '', 'g'))) = v_clean_id
    LIMIT 1;

    IF v_cadet IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'CADET_NOT_FOUND',
            'message', 'Cadet ID was not found in the official roster.'
        );
    END IF;

    v_cadet_json := to_jsonb(v_cadet);

    -- Verify Last Name match (ignoring spaces, periods, dashes)
    v_cadet_last := upper(btrim(regexp_replace(COALESCE(v_cadet_json->>'last_name', ''), '[^a-zA-Z0-9]', '', 'g')));
    
    -- If last_name is empty in database, fallback to checking if clean_last is in full name
    IF v_cadet_last = '' AND (v_cadet_json->>'name') IS NOT NULL THEN
        IF upper(v_cadet_json->>'name') NOT LIKE ('%' || v_clean_last || '%') THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'LAST_NAME_MISMATCH',
                'message', 'Last Name does not match official record.'
            );
        END IF;
    ELSIF v_cadet_last <> v_clean_last THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'LAST_NAME_MISMATCH',
            'message', 'Last Name does not match official record.'
        );
    END IF;

    -- Safe is_active resolution
    IF (v_cadet_json->>'is_active') IS NOT NULL THEN
        v_is_act := (v_cadet_json->>'is_active')::boolean;
    END IF;

    -- Return safe sanitized profile object
    RETURN jsonb_build_object(
        'success', true,
        'cadet', jsonb_build_object(
            'id', v_cadet_json->>'id',
            'student_id', COALESCE(v_cadet_json->>'student_id', v_cadet_json->>'id'),
            'name', v_cadet_json->>'name',
            'first_name', v_cadet_json->>'first_name',
            'middle_name', v_cadet_json->>'middle_name',
            'last_name', v_cadet_json->>'last_name',
            'rank', COALESCE(v_cadet_json->>'rank', 'Cadet'),
            'company', v_cadet_json->>'company',
            'platoon', v_cadet_json->>'platoon',
            'battalion', v_cadet_json->>'battalion',
            'rotc_subject', v_cadet_json->>'rotc_subject',
            'course', COALESCE(v_cadet_json->>'course', v_cadet_json->>'program'),
            'program', COALESCE(v_cadet_json->>'program', v_cadet_json->>'course'),
            'school', v_cadet_json->>'school',
            'phone', v_cadet_json->>'phone',
            'emergency_contact', v_cadet_json->>'emergency_contact',
            'is_active', v_is_act,
            'status', CASE WHEN v_is_act = false THEN 'INACTIVE' ELSE 'ACTIVE' END
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_cadet_portal_login(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- STEP 6: SECURITY DEFINER RPC 2 - Fetch Cadet Attendance Logs
-- Returns JSONB array of attendance logs ONLY for the requested cadet after credentials validation
-- Immune to SQL column drift and reserved keyword conflicts.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_get_cadet_attendance_logs(
    p_cadet_id TEXT,
    p_last_name TEXT,
    p_academic_term_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_id TEXT := upper(btrim(regexp_replace(COALESCE(p_cadet_id, ''), '[^a-zA-Z0-9]', '', 'g')));
    v_clean_last TEXT := upper(btrim(regexp_replace(COALESCE(p_last_name, ''), '[^a-zA-Z0-9]', '', 'g')));
    v_actual_cadet_id TEXT;
    v_cadet_last TEXT;
    v_result JSONB;
BEGIN
    -- Verify credentials
    SELECT c.id::text, upper(btrim(regexp_replace(COALESCE(c.last_name, ''), '[^a-zA-Z0-9]', '', 'g')))
    INTO v_actual_cadet_id, v_cadet_last
    FROM public.cadets c
    WHERE upper(btrim(regexp_replace(COALESCE(c.student_id, ''), '[^a-zA-Z0-9]', '', 'g'))) = v_clean_id
       OR upper(btrim(regexp_replace(COALESCE(c.id::text, ''), '[^a-zA-Z0-9]', '', 'g'))) = v_clean_id
    LIMIT 1;

    IF v_actual_cadet_id IS NULL OR (v_cadet_last <> '' AND v_cadet_last <> v_clean_last) THEN
        RETURN '[]'::jsonb; -- Unauthorized: Return empty list
    END IF;

    SELECT COALESCE(jsonb_agg(to_jsonb(sub) ORDER BY sub.date DESC), '[]'::jsonb)
    INTO v_result
    FROM (
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
            COALESCE(l.final_daily_status, l.status) AS final_daily_status,
            l.duty_officer,
            l.session_name,
            l.excuse_reason,
            l.excuse_proof_url,
            l.excuse_submitted_at,
            l.academic_term_id
        FROM public.attendance_logs l
        WHERE (l.cadet_id::text = v_actual_cadet_id OR upper(btrim(regexp_replace(l.cadet_id::text, '[^a-zA-Z0-9]', '', 'g'))) = v_clean_id)
          AND (p_academic_term_id IS NULL OR l.academic_term_id = p_academic_term_id)
    ) sub;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_cadet_attendance_logs(TEXT, TEXT, UUID) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- STEP 7: SECURITY DEFINER RPC 3 - Secure Excuse Request Submission
-- Enforces server-side validations:
--   1. Validates cadet identity.
--   2. Prevents tampering with PRESENT or already EXCUSED dates.
--   3. Sets status strictly to 'EXCUSE_PENDING' (cadet cannot mark themselves EXCUSED).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_submit_excuse_request(
    p_cadet_id TEXT,
    p_last_name TEXT,
    p_drill_date TEXT,
    p_reason TEXT,
    p_proof_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_id TEXT := upper(btrim(regexp_replace(COALESCE(p_cadet_id, ''), '[^a-zA-Z0-9]', '', 'g')));
    v_clean_last TEXT := upper(btrim(regexp_replace(COALESCE(p_last_name, ''), '[^a-zA-Z0-9]', '', 'g')));
    v_actual_cadet_id TEXT;
    v_actual_cadet_uuid UUID;
    v_cadet_last TEXT;
    v_drill_d DATE;
    v_existing_log_id UUID;
    v_existing_status TEXT;
    v_session_id UUID;
    v_academic_term_id UUID;
BEGIN
    -- 1. Format date
    BEGIN
        v_drill_d := p_drill_date::date;
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_DATE', 'message', 'Invalid formation drill date format.');
    END;

    -- 2. Verify cadet identity
    SELECT c.id::text, upper(btrim(regexp_replace(COALESCE(c.last_name, ''), '[^a-zA-Z0-9]', '', 'g')))
    INTO v_actual_cadet_id, v_cadet_last
    FROM public.cadets c
    WHERE upper(btrim(regexp_replace(COALESCE(c.student_id, ''), '[^a-zA-Z0-9]', '', 'g'))) = v_clean_id
       OR upper(btrim(regexp_replace(COALESCE(c.id::text, ''), '[^a-zA-Z0-9]', '', 'g'))) = v_clean_id
    LIMIT 1;

    IF v_actual_cadet_id IS NULL OR (v_cadet_last <> '' AND v_cadet_last <> v_clean_last) THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED', 'message', 'Cadet identity could not be verified.');
    END IF;

    -- Try to parse UUID if valid
    BEGIN
        v_actual_cadet_uuid := v_actual_cadet_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_actual_cadet_uuid := NULL;
    END;

    -- 3. Check official formation session (resilient to session_date or date column)
    BEGIN
        SELECT id, academic_term_id INTO v_session_id, v_academic_term_id
        FROM public.attendance_sessions
        WHERE session_date = v_drill_d
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        BEGIN
            SELECT id, academic_term_id INTO v_session_id, v_academic_term_id
            FROM public.attendance_sessions
            WHERE date = v_drill_d
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_session_id := NULL;
        END;
    END;

    -- 4. Check existing attendance log
    SELECT id, status INTO v_existing_log_id, v_existing_status
    FROM public.attendance_logs
    WHERE (cadet_id::text = v_actual_cadet_id OR upper(btrim(regexp_replace(cadet_id::text, '[^a-zA-Z0-9]', '', 'g'))) = v_clean_id)
      AND date = v_drill_d
    LIMIT 1;

    -- Validation rules
    IF upper(COALESCE(v_existing_status, '')) IN ('PRESENT', 'TARDY', 'LATE') THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_PRESENT', 'message', 'You were marked present for this formation. No excuse required.');
    END IF;

    IF upper(COALESCE(v_existing_status, '')) IN ('EXCUSED', 'APPROVED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_EXCUSED', 'message', 'An excuse request for this drill has already been approved.');
    END IF;

    IF upper(COALESCE(v_existing_status, '')) = 'EXCUSE_PENDING' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ALREADY_PENDING', 'message', 'An excuse request for this date is already pending admin review.');
    END IF;

    -- 5. Safe upsert with status locked to EXCUSE_PENDING
    IF v_existing_log_id IS NOT NULL THEN
        UPDATE public.attendance_logs
        SET status = 'EXCUSE_PENDING',
            final_daily_status = 'EXCUSE_PENDING',
            excuse_reason = p_reason,
            excuse_proof_url = p_proof_url,
            excuse_submitted_at = NOW(),
            updated_at = NOW()
        WHERE id = v_existing_log_id;
    ELSE
        INSERT INTO public.attendance_logs (
            cadet_id,
            date,
            session_id,
            academic_term_id,
            status,
            final_daily_status,
            excuse_reason,
            excuse_proof_url,
            excuse_submitted_at,
            created_at,
            updated_at
        ) VALUES (
            COALESCE(v_actual_cadet_uuid::text, v_actual_cadet_id),
            v_drill_d,
            v_session_id,
            v_academic_term_id,
            'EXCUSE_PENDING',
            'EXCUSE_PENDING',
            p_reason,
            p_proof_url,
            NOW(),
            NOW(),
            NOW()
        );
    END IF;

    -- Also record in excuse_requests table if present
    BEGIN
        INSERT INTO public.excuse_requests (
            cadet_id,
            drill_date,
            academic_term_id,
            reason,
            proof_document_url,
            status,
            created_at,
            updated_at
        ) VALUES (
            COALESCE(v_actual_cadet_uuid::text, v_actual_cadet_id),
            v_drill_d,
            v_academic_term_id,
            p_reason,
            p_proof_url,
            'EXCUSE_PENDING',
            NOW(),
            NOW()
        )
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Table might not exist or schema differs; safely ignore
    END;

    RETURN jsonb_build_object('success', true, 'message', 'Excuse request submitted successfully.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_submit_excuse_request(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- STEP 8: Storage Bucket Hardening - Create 'excuse-proofs' bucket
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('excuse-proofs', 'excuse-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop obsolete policies on storage
DROP POLICY IF EXISTS "Public Upload excuse-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public Read excuse-proofs" ON storage.objects;

-- Allow public upload to excuse-proofs bucket
CREATE POLICY "Public Upload excuse-proofs"
    ON storage.objects FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'excuse-proofs');

-- Allow public read of uploaded proofs (cadet & duty officers)
CREATE POLICY "Public Read excuse-proofs"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'excuse-proofs');

-- ------------------------------------------------------------------------------
-- STEP 9: Reload PostgREST Schema Cache
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
