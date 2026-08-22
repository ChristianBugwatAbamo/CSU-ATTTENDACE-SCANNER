-- ==============================================================================
-- CSU ROTC ATTENDANCE SYSTEM - GENERATE RANDOM TEST ATTENDANCE
-- Target Dates: Saturday Aug 08, 2026 & Saturday Aug 15, 2026
-- Distribution: 75% Absent, 15% Present, 10% Late / Incomplete
-- ==============================================================================

-- STEP 1: Ensure Attendance Sessions exist for Aug 08 and Aug 15, 2026
INSERT INTO public.attendance_sessions (
    session_date,
    session_name,
    duty_officer,
    cutoff_time,
    total_scanned,
    present_count,
    late_count,
    absent_count
) VALUES 
('2026-08-08', 'Saturday Tactical Field Training & Muster Formation', 'CPT CARLO V SANTOS (INF) PA', '07:30', 298, 179, 119, 896),
('2026-08-15', 'Saturday Marksmanship & Drill Ceremonies', '1LT ANGELO M REYES (INF) PA', '07:30', 298, 179, 119, 896)
ON CONFLICT (session_date) DO UPDATE SET
    session_name = EXCLUDED.session_name,
    duty_officer = EXCLUDED.duty_officer,
    cutoff_time = EXCLUDED.cutoff_time;

-- STEP 2: Generate Attendance for Saturday, August 08, 2026
-- 15% Present, 10% Late, 75% Absent
INSERT INTO public.attendance_logs (
    cadet_id,
    name,
    rank,
    battalion,
    company,
    platoon,
    designation,
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
    device_node,
    received_at
)
SELECT 
    c.id AS cadet_id,
    c.name,
    c.rank,
    c.battalion,
    c.company,
    c.platoon,
    c.designation,
    '2026-08-08'::date AS date,
    
    -- Time In
    CASE 
        -- 15% Present (Between 06:40:00 AM and 07:29:00 AM)
        WHEN r.rand_val < 0.15 THEN 
            ('2026-08-08 06:40:00+08'::timestamptz + (random() * 49 * interval '1 minute'))
        -- 10% Late (Between 07:31:00 AM and 08:15:00 AM)
        WHEN r.rand_val < 0.25 THEN 
            ('2026-08-08 07:31:00+08'::timestamptz + (random() * 44 * interval '1 minute'))
        -- 75% Absent (No Time In)
        ELSE NULL
    END AS time_in,

    -- Time Out
    CASE 
        -- 15% Present (Time out between 11:30:00 AM and 11:55:00 AM)
        WHEN r.rand_val < 0.15 THEN 
            ('2026-08-08 11:30:00+08'::timestamptz + (random() * 25 * interval '1 minute'))
        -- 10% Late (Half complete time out, half incomplete)
        WHEN r.rand_val < 0.25 AND r.rand_val > 0.20 THEN 
            ('2026-08-08 11:35:00+08'::timestamptz + (random() * 20 * interval '1 minute'))
        ELSE NULL
    END AS time_out,

    -- Timestamp
    COALESCE(
        CASE 
            WHEN r.rand_val < 0.15 THEN ('2026-08-08 06:40:00+08'::timestamptz + (random() * 49 * interval '1 minute'))
            WHEN r.rand_val < 0.25 THEN ('2026-08-08 07:31:00+08'::timestamptz + (random() * 44 * interval '1 minute'))
            ELSE NULL 
        END,
        '2026-08-08 07:30:00+08'::timestamptz
    ) AS timestamp,

    CASE 
        WHEN r.rand_val < 0.25 THEN 'Time-In'
        ELSE 'Time-In'
    END AS scan_mode,

    -- Time In Status
    CASE 
        WHEN r.rand_val < 0.15 THEN 'PRESENT'
        WHEN r.rand_val < 0.25 THEN 'LATE'
        ELSE 'NO TIME-IN'
    END AS time_in_status,

    -- Time Out Status
    CASE 
        WHEN r.rand_val < 0.15 THEN 'PRESENT'
        WHEN r.rand_val < 0.25 AND r.rand_val > 0.20 THEN 'PRESENT'
        ELSE 'NO TIME-OUT'
    END AS time_out_status,

    -- Final Status
    CASE 
        WHEN r.rand_val < 0.15 THEN 'PRESENT'
        WHEN r.rand_val < 0.25 THEN 'LATE'
        ELSE 'ABSENT'
    END AS status,

    CASE 
        WHEN r.rand_val < 0.15 THEN 'PRESENT'
        WHEN r.rand_val < 0.25 THEN 'LATE'
        ELSE 'ABSENT'
    END AS final_daily_status,

    'CPT CARLO V SANTOS (INF) PA' AS duty_officer,
    'Saturday Tactical Field Training & Muster Formation' AS session_name,
    'HQ Scanner Node 1' AS device_node,
    NOW() AS received_at

FROM public.cadets c
CROSS JOIN LATERAL (
    SELECT random() AS rand_val
) r
ON CONFLICT (cadet_id, date) DO UPDATE SET
    time_in = EXCLUDED.time_in,
    time_out = EXCLUDED.time_out,
    time_in_status = EXCLUDED.time_in_status,
    time_out_status = EXCLUDED.time_out_status,
    status = EXCLUDED.status,
    final_daily_status = EXCLUDED.final_daily_status,
    duty_officer = EXCLUDED.duty_officer,
    session_name = EXCLUDED.session_name,
    updated_at = NOW();


-- STEP 3: Generate Attendance for Saturday, August 15, 2026
-- 15% Present, 10% Late, 75% Absent (New Random Distribution)
INSERT INTO public.attendance_logs (
    cadet_id,
    name,
    rank,
    battalion,
    company,
    platoon,
    designation,
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
    device_node,
    received_at
)
SELECT 
    c.id AS cadet_id,
    c.name,
    c.rank,
    c.battalion,
    c.company,
    c.platoon,
    c.designation,
    '2026-08-15'::date AS date,
    
    -- Time In
    CASE 
        -- 15% Present (Between 06:40:00 AM and 07:29:00 AM)
        WHEN r.rand_val < 0.15 THEN 
            ('2026-08-15 06:40:00+08'::timestamptz + (random() * 49 * interval '1 minute'))
        -- 10% Late (Between 07:31:00 AM and 08:15:00 AM)
        WHEN r.rand_val < 0.25 THEN 
            ('2026-08-15 07:31:00+08'::timestamptz + (random() * 44 * interval '1 minute'))
        -- 75% Absent (No Time In)
        ELSE NULL
    END AS time_in,

    -- Time Out
    CASE 
        -- 15% Present (Time out between 11:30:00 AM and 11:55:00 AM)
        WHEN r.rand_val < 0.15 THEN 
            ('2026-08-15 11:30:00+08'::timestamptz + (random() * 25 * interval '1 minute'))
        -- 10% Late
        WHEN r.rand_val < 0.25 AND r.rand_val > 0.20 THEN 
            ('2026-08-15 11:35:00+08'::timestamptz + (random() * 20 * interval '1 minute'))
        ELSE NULL
    END AS time_out,

    -- Timestamp
    COALESCE(
        CASE 
            WHEN r.rand_val < 0.15 THEN ('2026-08-15 06:40:00+08'::timestamptz + (random() * 49 * interval '1 minute'))
            WHEN r.rand_val < 0.25 THEN ('2026-08-15 07:31:00+08'::timestamptz + (random() * 44 * interval '1 minute'))
            ELSE NULL 
        END,
        '2026-08-15 07:30:00+08'::timestamptz
    ) AS timestamp,

    CASE 
        WHEN r.rand_val < 0.25 THEN 'Time-In'
        ELSE 'Time-In'
    END AS scan_mode,

    -- Time In Status
    CASE 
        WHEN r.rand_val < 0.15 THEN 'PRESENT'
        WHEN r.rand_val < 0.25 THEN 'LATE'
        ELSE 'NO TIME-IN'
    END AS time_in_status,

    -- Time Out Status
    CASE 
        WHEN r.rand_val < 0.15 THEN 'PRESENT'
        WHEN r.rand_val < 0.25 AND r.rand_val > 0.20 THEN 'PRESENT'
        ELSE 'NO TIME-OUT'
    END AS time_out_status,

    -- Final Status
    CASE 
        WHEN r.rand_val < 0.15 THEN 'PRESENT'
        WHEN r.rand_val < 0.25 THEN 'LATE'
        ELSE 'ABSENT'
    END AS status,

    CASE 
        WHEN r.rand_val < 0.15 THEN 'PRESENT'
        WHEN r.rand_val < 0.25 THEN 'LATE'
        ELSE 'ABSENT'
    END AS final_daily_status,

    '1LT ANGELO M REYES (INF) PA' AS duty_officer,
    'Saturday Marksmanship & Drill Ceremonies' AS session_name,
    'HQ Scanner Node 1' AS device_node,
    NOW() AS received_at

FROM public.cadets c
CROSS JOIN LATERAL (
    SELECT random() AS rand_val
) r
ON CONFLICT (cadet_id, date) DO UPDATE SET
    time_in = EXCLUDED.time_in,
    time_out = EXCLUDED.time_out,
    time_in_status = EXCLUDED.time_in_status,
    time_out_status = EXCLUDED.time_out_status,
    status = EXCLUDED.status,
    final_daily_status = EXCLUDED.final_daily_status,
    duty_officer = EXCLUDED.duty_officer,
    session_name = EXCLUDED.session_name,
    updated_at = NOW();

-- STEP 4: Verification Summary Query
SELECT 
    date,
    status,
    COUNT(*) AS cadet_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY date), 1) AS percentage
FROM public.attendance_logs
WHERE date IN ('2026-08-08', '2026-08-15')
GROUP BY date, status
ORDER BY date, status;
