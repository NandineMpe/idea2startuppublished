-- ============================================================
-- Client Workspaces / Multi-tenant intake
-- Share a link, collect context, and generate against that workspace.
-- ============================================================

CREATE TABLE IF NOT EXISTS client_workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  share_token TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  company_name TEXT,
  context_status TEXT NOT NULL DEFAULT 'draft' CHECK (context_status IN ('draft', 'intake_started', 'ready')),
  last_context_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_workspace_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES client_workspaces(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  tagline TEXT,
  company_description TEXT,
  problem TEXT,
  solution TEXT,
  target_market TEXT,
  industry TEXT,
  vertical TEXT,
  stage TEXT,
  traction TEXT,
  team_summary TEXT,
  funding_goal TEXT,
  founder_name TEXT,
  founder_location TEXT,
  founder_background TEXT,
  thesis TEXT,
  business_model TEXT,
  differentiators TEXT,
  icp JSONB DEFAULT '[]'::jsonb,
  competitors JSONB DEFAULT '[]'::jsonb,
  keywords JSONB DEFAULT '[]'::jsonb,
  priorities JSONB DEFAULT '[]'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  jack_jill_jobs JSONB DEFAULT '[]'::jsonb,
  brand_voice TEXT,
  brand_promise TEXT,
  brand_never_say TEXT,
  brand_proof_points TEXT,
  brand_voice_dna TEXT,
  brand_channel_voice JSONB DEFAULT '{"linkedin":"","cold_email":"","reddit_hn":""}'::jsonb,
  brand_words_use JSONB DEFAULT '[]'::jsonb,
  brand_words_never JSONB DEFAULT '[]'::jsonb,
  brand_credibility_hooks JSONB DEFAULT '[]'::jsonb,
  knowledge_base_md TEXT,
  knowledge_base_updated_at TIMESTAMPTZ,
  github_vault_owner TEXT,
  github_vault_repo TEXT,
  github_vault_branch TEXT DEFAULT 'main',
  github_vault_path TEXT,
  vault_folders JSONB DEFAULT '[]'::jsonb,
  vault_context_cache TEXT,
  vault_context_last_synced_at TIMESTAMPTZ,
  vault_context_file_count INT DEFAULT 0,
  vault_context_sync_error TEXT,
  github_repo TEXT,
  github_branch TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_workspace_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID NOT NULL REFERENCES client_workspaces(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pitch_deck', 'document', 'scraped_url')),
  title TEXT NOT NULL,
  source_url TEXT,
  content TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE client_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_workspace_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_workspace_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own client workspaces"
  ON client_workspaces FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners can insert own client workspaces"
  ON client_workspaces FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owners can update own client workspaces"
  ON client_workspaces FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners can delete own client workspaces"
  ON client_workspaces FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can view own workspace profiles"
  ON client_workspace_profiles FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners can insert own workspace profiles"
  ON client_workspace_profiles FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owners can update own workspace profiles"
  ON client_workspace_profiles FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners can delete own workspace profiles"
  ON client_workspace_profiles FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Owners can view own workspace assets"
  ON client_workspace_assets FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners can insert own workspace assets"
  ON client_workspace_assets FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Owners can update own workspace assets"
  ON client_workspace_assets FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners can delete own workspace assets"
  ON client_workspace_assets FOR DELETE USING (auth.uid() = owner_user_id);

CREATE INDEX IF NOT EXISTS idx_client_workspaces_owner_user_id
  ON client_workspaces(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_client_workspaces_share_token
  ON client_workspaces(share_token);
CREATE INDEX IF NOT EXISTS idx_client_workspaces_slug
  ON client_workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_client_workspace_profiles_owner_user_id
  ON client_workspace_profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_client_workspace_profiles_workspace_id
  ON client_workspace_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_workspace_assets_owner_user_id
  ON client_workspace_assets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_client_workspace_assets_workspace_id
  ON client_workspace_assets(workspace_id);

CREATE TRIGGER set_client_workspaces_updated_at
  BEFORE UPDATE ON client_workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_client_workspace_profiles_updated_at
  BEFORE UPDATE ON client_workspace_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
