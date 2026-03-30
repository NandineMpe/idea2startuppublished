-- Security scanner: repo pointer + findings + scan audit trail
--
-- PREREQUISITES (run in order if you apply files manually in the SQL Editor):
--   1. 001_initial_schema.sql  — defines update_updated_at() used by company_profile trigger
--   2. 002_company_profile.sql  — creates public.company_profile
--   3. (this file) 026_security_updates.sql
-- Or: node scripts/apply-all-supabase-migrations.cjs — applies every migration in sorted order.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_profile'
  ) THEN
    RAISE EXCEPTION
      'Table company_profile does not exist. Run 001_initial_schema.sql then 002_company_profile.sql first (see comment at top of this file).';
  END IF;
END $$;

ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS github_repo TEXT,
  ADD COLUMN IF NOT EXISTS github_branch TEXT DEFAULT 'main';

COMMENT ON COLUMN company_profile.github_repo IS 'owner/repo for security scans (optional; falls back to Obsidian vault repo)';
COMMENT ON COLUMN company_profile.github_branch IS 'Default branch for security scans';

CREATE TABLE IF NOT EXISTS security_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL,
  repo text NOT NULL,
  branch text NOT NULL,
  mode text NOT NULL DEFAULT 'daily',
  status text NOT NULL CHECK (status IN ('completed', 'failed')),
  files_scanned int,
  total_findings int,
  new_findings int,
  resolved_count int,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_scans_user_created ON security_scans(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS security_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category text,
  title text NOT NULL,
  description text,
  file_path text,
  line_number int,
  code_snippet text,
  fix_suggestion text,
  fix_effort text,
  fix_code text,
  exploit_scenario text,
  confidence int,
  verification_status text DEFAULT 'UNVERIFIED',
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'false_positive', 'accepted_risk', 'auto_resolved')),
  resolution_notes text,
  resolved_at timestamptz,
  phase int,
  phase_name text,
  impact text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_security_findings_user_status ON security_findings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_security_findings_user_severity ON security_findings(user_id, severity);

ALTER TABLE security_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own security_scans" ON security_scans;
DROP POLICY IF EXISTS "Users can read own security_findings" ON security_findings;
DROP POLICY IF EXISTS "Users can update own security_findings" ON security_findings;

CREATE POLICY "Users can read own security_scans"
  ON security_scans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own security_findings"
  ON security_findings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own security_findings"
  ON security_findings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
