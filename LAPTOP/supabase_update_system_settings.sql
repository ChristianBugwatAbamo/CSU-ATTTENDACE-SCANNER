-- ==============================================================================
-- SQL MIGRATION: Add Complete 4-Tab Settings Columns to public.system_settings
-- Run this script in the Supabase Dashboard -> SQL Editor
-- ==============================================================================

ALTER TABLE public.system_settings 
ADD COLUMN IF NOT EXISTS total_unit_target INTEGER NOT NULL DEFAULT 1184,
ADD COLUMN IF NOT EXISTS unit_structure JSONB,
ADD COLUMN IF NOT EXISTS excel_export_path TEXT DEFAULT './desktop_excel_reports/',
ADD COLUMN IF NOT EXISTS letterhead_config JSONB,
ADD COLUMN IF NOT EXISTS auto_excel_export BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS id_signatory_name VARCHAR(255) DEFAULT 'LTC CHRISTIAN B ABAMO INF (GSC) PA',
ADD COLUMN IF NOT EXISTS id_signatory_title VARCHAR(255) DEFAULT 'Commandant, CSU ROTC Unit',
ADD COLUMN IF NOT EXISTS id_signature_url TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS id_card_orientation VARCHAR(20) NOT NULL DEFAULT 'vertical',
ADD COLUMN IF NOT EXISTS officer_ranks_list JSONB,
ADD COLUMN IF NOT EXISTS officer_roles_list JSONB;

-- Verify columns in system_settings
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'system_settings'
ORDER BY ordinal_position;
