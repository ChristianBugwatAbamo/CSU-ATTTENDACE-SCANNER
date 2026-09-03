-- ==============================================================================
-- CSU ROTC ATTENDANCE & ROSTER SYSTEM - MASTER SUPABASE POSTGRESQL SCHEMA
-- Target Database: PostgreSQL 15+ / Supabase
-- Description: Core Master Schema containing the 4 connected production tables:
--              1. system_settings
--              2. cadets (Master Roster)
--              3. attendance_sessions (Training Formations & Dates)
--              4. attendance_logs (Daily Time-In & Time-Out Records)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE: system_settings
-- Global administrative configurations, cutoff times, unit branding, and ID setup
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Tab 1: Muster & Unit Configuration
    formation_cutoff_time VARCHAR(10) NOT NULL DEFAULT '07:30',
    formation_tardy_grace INTEGER NOT NULL DEFAULT 15,
    cadet_quota_per_platoon INTEGER NOT NULL DEFAULT 37,
    total_unit_target INTEGER NOT NULL DEFAULT 1184,
    unit_structure JSONB,
    
    -- Tab 2: Unit Branding
    unit_name VARCHAR(255) NOT NULL DEFAULT '1501st CDC ROTC Unit',
    commanding_officer VARCHAR(255) NOT NULL DEFAULT 'LTC CHRISTIAN B ABAMO INF (GSC) PA',
    commanding_officer_title VARCHAR(255) NOT NULL DEFAULT 'Commandant, CSU ROTC Unit',
    parent_command VARCHAR(255) NOT NULL DEFAULT '15th RCDG, ARESCOM, Philippine Army',
    host_institution VARCHAR(255) NOT NULL DEFAULT 'Caraga State University (CSU Main Campus, Ampayon, Butuan City)',
    rotc_seal_url TEXT DEFAULT '/rotc-seal-transparent.png',
    university_logo_url TEXT DEFAULT '/csu-logo.png',
    
    -- Tab 3: Data Management & Exports
    excel_export_path TEXT DEFAULT './desktop_excel_reports/',
    letterhead_config JSONB,
    auto_excel_export BOOLEAN NOT NULL DEFAULT true,
    auto_backup_enabled BOOLEAN NOT NULL DEFAULT true,
    
    -- Tab 4: ROTC ID Printing Setup
    id_signatory_name VARCHAR(255) DEFAULT 'LTC CHRISTIAN B ABAMO INF (GSC) PA',
    id_signatory_title VARCHAR(255) DEFAULT 'Commandant, CSU ROTC Unit',
    id_signature_url TEXT DEFAULT '',
    id_card_orientation VARCHAR(20) NOT NULL DEFAULT 'vertical',
    officer_ranks_list JSONB,
    officer_roles_list JSONB,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. TABLE: cadets (Master Cadet Profiles)
-- Master registry of all 1,200 cadets (Officers & Basic Cadets)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cadets (
    id VARCHAR(30) PRIMARY KEY, -- e.g., '221-00101', '221-11101'
    name VARCHAR(255) NOT NULL,
    rank VARCHAR(100) NOT NULL DEFAULT 'Cadet',
    battalion VARCHAR(100) NOT NULL DEFAULT '1st Battalion',
    company VARCHAR(100) NOT NULL DEFAULT 'Alpha Company',
    platoon VARCHAR(100) NOT NULL DEFAULT '1st Platoon',
    type VARCHAR(50) NOT NULL DEFAULT 'Basic Cadet', -- 'Basic Cadet' | 'Cadet Officer'
    designation VARCHAR(150) NOT NULL DEFAULT 'N/A', -- 'Squad Leader', 'Platoon Guide', 'Corps Commander', etc.
    course VARCHAR(150),
    department VARCHAR(100),
    contact_number VARCHAR(50),
    emergency_contact VARCHAR(150),
    qr_code_payload TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cadets_battalion ON public.cadets(battalion);
CREATE INDEX IF NOT EXISTS idx_cadets_company ON public.cadets(company);
CREATE INDEX IF NOT EXISTS idx_cadets_platoon ON public.cadets(platoon);
CREATE INDEX IF NOT EXISTS idx_cadets_type ON public.cadets(type);
CREATE INDEX IF NOT EXISTS idx_cadets_name ON public.cadets(name);

-- ==============================================================================
-- 4. TABLE: attendance_sessions (Formations & Training Dates)
-- Supports multiple duty officer batches on the same date via composite constraint
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_date DATE NOT NULL,
    session_name VARCHAR(255) NOT NULL,
    duty_officer VARCHAR(255) NOT NULL,
    cutoff_time VARCHAR(10) NOT NULL DEFAULT '07:30',
    total_scanned INTEGER NOT NULL DEFAULT 0,
    present_count INTEGER NOT NULL DEFAULT 0,
    late_count INTEGER NOT NULL DEFAULT 0,
    absent_count INTEGER NOT NULL DEFAULT 0,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_date_duty_officer UNIQUE (session_date, duty_officer)
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.attendance_sessions(session_date DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_officer ON public.attendance_sessions(duty_officer);

-- ==============================================================================
-- 5. TABLE: attendance_logs (Master Attendance & Scan Records)
-- Stores single-row daily attendance per cadet (Time-In & Time-Out)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
    cadet_id VARCHAR(30) NOT NULL REFERENCES public.cadets(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    rank VARCHAR(100) NOT NULL DEFAULT 'Cadet',
    battalion VARCHAR(100) NOT NULL DEFAULT '1st Battalion',
    company VARCHAR(100) NOT NULL DEFAULT 'Alpha Company',
    platoon VARCHAR(100) NOT NULL DEFAULT '1st Platoon',
    designation VARCHAR(150) DEFAULT 'N/A',
    
    -- Date & Time tracking
    date DATE NOT NULL,
    time_in TIMESTAMPTZ,
    time_out TIMESTAMPTZ,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Scan Mode & Evaluated Status
    scan_mode VARCHAR(20) NOT NULL DEFAULT 'Time-In', -- 'Time-In' | 'Time-Out'
    time_in_status VARCHAR(50),                       -- 'PRESENT' | 'LATE' | 'NO TIME-IN'
    time_out_status VARCHAR(50),                      -- 'PRESENT' | 'NO TIME-OUT'
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT',    -- 'PRESENT' | 'LATE' | 'NO TIME-OUT' | 'LATE / NO TIME-OUT' | 'ABSENT'
    final_daily_status VARCHAR(50) NOT NULL DEFAULT 'PRESENT',
    
    -- Metadata
    duty_officer VARCHAR(255) DEFAULT 'Duty Officer',
    session_name VARCHAR(255) DEFAULT 'Training Formation',
    scanned_by VARCHAR(150),
    device_node VARCHAR(100) DEFAULT 'Scanner Terminal',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint: A cadet has at most one daily attendance record per date
    CONSTRAINT uq_cadet_date_attendance UNIQUE (cadet_id, date)
);

CREATE INDEX IF NOT EXISTS idx_logs_date ON public.attendance_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_logs_cadet ON public.attendance_logs(cadet_id);
CREATE INDEX IF NOT EXISTS idx_logs_status ON public.attendance_logs(status);
CREATE INDEX IF NOT EXISTS idx_logs_company ON public.attendance_logs(company);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_session_id ON public.attendance_logs(session_id);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access to all users (scanner devices & desktop dashboard)
CREATE POLICY "Allow public read access on system_settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Allow public read access on cadets" ON public.cadets FOR SELECT USING (true);
CREATE POLICY "Allow public read access on attendance_sessions" ON public.attendance_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public read access on attendance_logs" ON public.attendance_logs FOR SELECT USING (true);

-- Allow all write operations (anon & authenticated)
CREATE POLICY "Allow all operations on system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on cadets" ON public.cadets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on attendance_sessions" ON public.attendance_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on attendance_logs" ON public.attendance_logs FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. INITIAL SEED: DEFAULT SYSTEM SETTINGS
-- ==============================================================================
INSERT INTO public.system_settings (
    formation_cutoff_time,
    formation_tardy_grace,
    cadet_quota_per_platoon,
    commanding_officer,
    commanding_officer_title,
    unit_name,
    parent_command,
    host_institution
) VALUES (
    '07:30',
    15,
    37,
    'LTC CHRISTIAN B ABAMO INF (GSC) PA',
    'Commandant, CSU ROTC Unit',
    '1501st CDC ROTC Unit',
    '15th RCDG, ARESCOM, Philippine Army',
    'Caraga State University (CSU Main Campus, Ampayon, Butuan City)'
) ON CONFLICT DO NOTHING;
