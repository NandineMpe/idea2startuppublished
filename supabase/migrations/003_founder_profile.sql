-- ============================================================
-- Founder Profile — where the founder is, what they've been doing
-- Run in Supabase Dashboard > SQL Editor after 002_company_profile.sql
-- ============================================================

ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS founder_name TEXT,
  ADD COLUMN IF NOT EXISTS founder_location TEXT,
  ADD COLUMN IF NOT EXISTS founder_background TEXT;

COMMENT ON COLUMN company_profile.founder_name IS 'Founder full name';
COMMENT ON COLUMN company_profile.founder_location IS 'Where founder is: city, country, timezone';
COMMENT ON COLUMN company_profile.founder_background IS 'Full narrative: career path, education, experience, what they''ve been doing, current focus';
