-- Primary context document + cached Obsidian vault context for /dashboard/context

ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS knowledge_base_md TEXT,
  ADD COLUMN IF NOT EXISTS knowledge_base_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vault_folders TEXT[] NOT NULL DEFAULT ARRAY['company', 'juno', 'research']::TEXT[],
  ADD COLUMN IF NOT EXISTS vault_context_cache TEXT,
  ADD COLUMN IF NOT EXISTS vault_context_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vault_context_file_count INT,
  ADD COLUMN IF NOT EXISTS vault_context_sync_error TEXT;

COMMENT ON COLUMN company_profile.knowledge_base_md IS 'Primary markdown context document authored by the founder and read by all agents';
COMMENT ON COLUMN company_profile.knowledge_base_updated_at IS 'Last time the primary markdown context document changed';
COMMENT ON COLUMN company_profile.vault_folders IS 'Top-level Obsidian/GitHub vault folders to include in the cached context digest';
COMMENT ON COLUMN company_profile.vault_context_cache IS 'Cached markdown digest from the connected Obsidian vault; agents read this instead of calling GitHub live';
COMMENT ON COLUMN company_profile.vault_context_last_synced_at IS 'Last successful refresh of vault_context_cache';
COMMENT ON COLUMN company_profile.vault_context_file_count IS 'Markdown file count included by the most recent vault sync';
COMMENT ON COLUMN company_profile.vault_context_sync_error IS 'Most recent vault sync error, if any';

UPDATE company_profile
SET vault_folders = ARRAY['company', 'juno', 'research']::TEXT[]
WHERE vault_folders IS NULL OR cardinality(vault_folders) = 0;
