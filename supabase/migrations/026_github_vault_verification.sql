-- Persist last vault probe so Integrations can show "last verified" after reload
ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS github_vault_last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS github_vault_last_probe_file_count INT,
  ADD COLUMN IF NOT EXISTS github_vault_last_probe_error TEXT;

COMMENT ON COLUMN company_profile.github_vault_last_verified_at IS 'Last successful Save & test (or probe) for Obsidian vault GitHub settings';
COMMENT ON COLUMN company_profile.github_vault_last_probe_file_count IS 'Markdown file count from last probe';
COMMENT ON COLUMN company_profile.github_vault_last_probe_error IS 'Error message from last probe, if any';
