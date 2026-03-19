-- ============================================================
-- Company Profile & Assets
-- Run in Supabase Dashboard > SQL Editor after 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- TABLE: company_profile
-- One row per user — structured "what we do" fields
-- ============================================================
CREATE TABLE IF NOT EXISTS company_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  tagline TEXT,
  problem TEXT,
  solution TEXT,
  target_market TEXT,
  industry TEXT,
  stage TEXT,
  traction TEXT,
  team_summary TEXT,
  funding_goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: company_assets
-- Documents, pitch deck, scraped content
-- ============================================================
CREATE TABLE IF NOT EXISTS company_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('pitch_deck', 'document', 'scraped_url')),
  title TEXT NOT NULL,
  source_url TEXT,
  content TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company profile"
  ON company_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own company profile"
  ON company_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own company profile"
  ON company_profile FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own company profile"
  ON company_profile FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own company assets"
  ON company_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own company assets"
  ON company_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own company assets"
  ON company_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own company assets"
  ON company_assets FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_company_profile_user_id ON company_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_company_assets_user_id ON company_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_company_assets_type ON company_assets(type);

-- ============================================================
-- Auto-update updated_at for company_profile
-- ============================================================
CREATE TRIGGER set_company_profile_updated_at
  BEFORE UPDATE ON company_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
