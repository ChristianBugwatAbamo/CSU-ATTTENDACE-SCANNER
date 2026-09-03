-- =========================================================================
-- ROTC Attendance System - Letterhead Storage Columns Migration
-- =========================================================================
-- Execute this query in Supabase SQL Editor to add storage columns for
-- custom formatted letterhead HTML, Office Symbol, and Unit Seals.

ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS letterhead_html TEXT,
ADD COLUMN IF NOT EXISTS office_symbol VARCHAR(50) DEFAULT 'CSUROTCU1',
ADD COLUMN IF NOT EXISTS left_logo_url TEXT DEFAULT '/csug-logo.png',
ADD COLUMN IF NOT EXISTS right_logo_url TEXT DEFAULT '/rotc-seal-transparent.png';
