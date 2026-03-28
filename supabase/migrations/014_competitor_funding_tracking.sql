-- Persistent competitor events and funding rounds (CBS daily brief + staff meeting + Obsidian)

CREATE TABLE IF NOT EXISTS competitor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  competitor_name TEXT NOT NULL,
  competitor_url TEXT,

  event_type TEXT NOT NULL,

  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  source TEXT,

  why_it_matters TEXT,
  threat_level TEXT,
  suggested_response TEXT,

  funding_amount TEXT,
  funding_round TEXT,
  lead_investor TEXT,

  event_date DATE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE competitor_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own competitor_tracking"
  ON competitor_tracking FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_competitor_user ON competitor_tracking(user_id, competitor_name);
CREATE INDEX IF NOT EXISTS idx_competitor_discovered ON competitor_tracking(user_id, discovered_at DESC);

CREATE TABLE IF NOT EXISTS funding_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  company_name TEXT NOT NULL,
  company_url TEXT,
  is_competitor BOOLEAN NOT NULL DEFAULT FALSE,
  is_in_our_space BOOLEAN NOT NULL DEFAULT TRUE,

  round_type TEXT,
  amount TEXT,
  valuation TEXT,
  lead_investor TEXT,
  other_investors TEXT[],

  announced_date DATE,

  relevance TEXT,
  signal TEXT,
  threat_or_opportunity TEXT,

  url TEXT,
  source TEXT,

  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE funding_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own funding_tracker"
  ON funding_tracker FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_funding_user_date ON funding_tracker(user_id, announced_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_funding_competitor ON funding_tracker(user_id, is_competitor);
