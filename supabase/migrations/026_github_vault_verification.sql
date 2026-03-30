-- Persist last vault probe so Integrations can show "last verified" after reload
-- Requires public.company_profile — run 001_initial_schema.sql then 002_company_profile.sql first.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'company_profile'
  ) THEN
    RAISE EXCEPTION
      'Table company_profile does not exist. Run 001_initial_schema.sql then 002_company_profile.sql first.';
  END IF;
END $$;

ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS github_vault_last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS github_vault_last_probe_file_count INT,
  ADD COLUMN IF NOT EXISTS github_vault_last_probe_error TEXT;

COMMENT ON COLUMN company_profile.github_vault_last_verified_at IS 'Last successful Save & test (or probe) for Obsidian vault GitHub settings';
COMMENT ON COLUMN company_profile.github_vault_last_probe_file_count IS 'Markdown file count from last probe';
COMMENT ON COLUMN company_profile.github_vault_last_probe_error IS 'Error message from last probe, if any';
