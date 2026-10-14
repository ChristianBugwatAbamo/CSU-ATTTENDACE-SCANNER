-- ==============================================================================
-- MIGRATION: COMMAND CENTER ADMIN WHITELIST (STRICT ADMIN AUTHENTICATION)
-- Target Database: PostgreSQL 15+ / Supabase
-- Target Tables: public.admin_whitelist
-- Target Functions: public.get_admin_profile(), public.is_admin(),
--                   public.handle_admin_access_request() (auth.users trigger)
--
-- Sign-in flow:
--   1. Client calls supabase.auth.signInWithPassword({ email, password })
--   2. Client calls supabase.rpc('get_admin_profile')
--   3. No row          -> not whitelisted -> sign out + reject
--      is_active=false -> pending approval -> sign out + reject
--      is_active=true  -> allowed
--
-- Request-access flow:
--   1. Client calls supabase.auth.signUp() with metadata
--      { admin_access_request: true, full_name, title }
--   2. The auth.users trigger below inserts a PENDING row
--      (is_active = FALSE, role = 'ADMIN') into admin_whitelist.
--   3. An administrator approves by setting is_active = TRUE.
--
-- The whitelist table itself is NOT readable/writable by anon/authenticated.
-- All access goes through SECURITY DEFINER functions that derive identity
-- from auth.uid() / auth.users, never from client-supplied values.
--
-- This script is idempotent — safe to re-run over the previous version.
-- ==============================================================================

-- 1. Whitelist table (new requests default to INACTIVE / pending)
CREATE TABLE IF NOT EXISTS public.admin_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'ADMIN'
        CHECK (role IN ('SUPER_ADMIN', 'COMMANDANT_HQ', 'ADMIN')),
    full_name TEXT,
    title TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admin_whitelist_email_lowercase CHECK (email = lower(btrim(email)))
);

-- Upgrade path for databases that ran the earlier version (DEFAULT TRUE)
ALTER TABLE public.admin_whitelist ALTER COLUMN is_active SET DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS admin_whitelist_email_key
    ON public.admin_whitelist (email);

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.admin_whitelist_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_whitelist_updated_at ON public.admin_whitelist;
CREATE TRIGGER trg_admin_whitelist_updated_at
    BEFORE UPDATE ON public.admin_whitelist
    FOR EACH ROW EXECUTE FUNCTION public.admin_whitelist_touch_updated_at();

-- 2. Lock the table down: RLS on, no policies, no grants for client roles.
--    Manage rows via the Supabase Dashboard / SQL editor (service_role).
ALTER TABLE public.admin_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_whitelist FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_whitelist FROM anon, authenticated;
GRANT ALL ON TABLE public.admin_whitelist TO service_role;

-- 3. Returns the caller's whitelist row (active OR pending), or zero rows if
--    not whitelisted. The client must check is_active === true.
--    Return type changed from the previous version, so drop first.
DROP FUNCTION IF EXISTS public.get_admin_profile();
CREATE FUNCTION public.get_admin_profile()
RETURNS TABLE (email TEXT, role TEXT, full_name TEXT, title TEXT, is_active BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT w.email, w.role, w.full_name, w.title, w.is_active
    FROM public.admin_whitelist w
    JOIN auth.users u ON lower(u.email) = w.email
    WHERE u.id = auth.uid()
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_admin_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_profile() TO authenticated;

-- 4. Boolean helper (ACTIVE admins only) — reuse inside RLS policies, e.g.
--    CREATE POLICY "admins can write" ON public.cadets
--        FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_whitelist w
        JOIN auth.users u ON lower(u.email) = w.email
        WHERE u.id = auth.uid()
          AND w.is_active = TRUE
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 5. Access-request trigger on auth.users.
--    Runs server-side at sign-up, so it works even when "Confirm email" is
--    enabled (no client session exists yet). Values are HARD-CODED to
--    is_active = FALSE / role = 'ADMIN' — a client cannot self-approve or
--    pick a role, and ON CONFLICT DO NOTHING means an existing row
--    (e.g. an approved admin) can never be overwritten.
CREATE OR REPLACE FUNCTION public.handle_admin_access_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.email IS NOT NULL
       AND COALESCE(NEW.raw_user_meta_data ->> 'admin_access_request', '') = 'true' THEN
        INSERT INTO public.admin_whitelist (email, role, full_name, title, is_active)
        VALUES (
            lower(btrim(NEW.email)),
            'ADMIN',
            NULLIF(left(btrim(NEW.raw_user_meta_data ->> 'full_name'), 150), ''),
            NULLIF(left(btrim(NEW.raw_user_meta_data ->> 'title'), 150), ''),
            FALSE
        )
        ON CONFLICT (email) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_admin_access_request() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_admin_access_request ON auth.users;
CREATE TRIGGER on_auth_user_admin_access_request
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_admin_access_request();

-- 6. Seed / approve admins.
--    Each email must ALSO exist as a user in Supabase Auth.
--    Emails must be lowercase. Note: is_active must be set explicitly now.
--
-- INSERT INTO public.admin_whitelist (email, role, full_name, title, is_active) VALUES
--     ('commandant@csu.edu.ph', 'COMMANDANT_HQ', 'LTC RYAN L MARCELO INF (GSC) PA', 'Commandant, CSU ROTC Unit', TRUE)
-- ON CONFLICT (email) DO UPDATE
--     SET role = EXCLUDED.role,
--         full_name = EXCLUDED.full_name,
--         title = EXCLUDED.title,
--         is_active = TRUE;

-- Review pending requests:
-- SELECT email, full_name, title, created_at FROM public.admin_whitelist
-- WHERE is_active = FALSE ORDER BY created_at;

-- Approve a request:
-- UPDATE public.admin_whitelist SET is_active = TRUE WHERE email = 'someone@csu.edu.ph';

-- Revoke access without deleting the auth user:
-- UPDATE public.admin_whitelist SET is_active = FALSE WHERE email = 'someone@csu.edu.ph';
