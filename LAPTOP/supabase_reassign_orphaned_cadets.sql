-- ==============================================================================
-- CSU ROTC ATTENDANCE & ROSTER SYSTEM - SUPABASE DATABASE FIX
-- Feature: Reassign Cadets from Removed Companies (e.g. 2nd Bn Alpha -> Charlie)
-- Instructions: Run this in your Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Paste & Click Run)
-- ==============================================================================

-- 1. Move cadets from removed Alpha Company in 2nd Bn to Charlie Company
UPDATE public.cadets
SET company = 'Charlie Company'
WHERE (battalion ILIKE '%2nd%' OR battalion ILIKE '%Second%')
  AND (company ILIKE '%Alpha%');

-- 2. Update existing attendance logs to reflect the new company assignment
UPDATE public.attendance_logs
SET company = 'Charlie Company'
WHERE (battalion ILIKE '%2nd%' OR battalion ILIKE '%Second%')
  AND (company ILIKE '%Alpha%');

-- 3. Confirm reassignment of affected cadets
SELECT id, name, cadet_id, battalion, company, platoon 
FROM public.cadets 
WHERE name IN ('BAYOTLANG, ROY G.', 'BUQUE, CRESS T.', 'LUBI, BOKO N.')
   OR (battalion ILIKE '%2nd%' AND company ILIKE '%Charlie%');
