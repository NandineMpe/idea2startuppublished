-- Obsidian vault → GitHub: per-user repo pointer (markdown read via GitHub API in app)
ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS github_vault_owner TEXT,
  ADD COLUMN IF NOT EXISTS github_vault_repo TEXT,
  ADD COLUMN IF NOT EXISTS github_vault_branch TEXT NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS github_vault_path TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN company_profile.github_vault_owner IS 'GitHub org or user that owns the vault repo';
COMMENT ON COLUMN company_profile.github_vault_repo IS 'Repo name (Obsidian vault pushed via obsidian-git)';
COMMENT ON COLUMN company_profile.github_vault_branch IS 'Branch to read (default main)';
COMMENT ON COLUMN company_profile.github_vault_path IS 'Optional subfolder prefix inside repo, e.g. notes/ — empty = repo root';
