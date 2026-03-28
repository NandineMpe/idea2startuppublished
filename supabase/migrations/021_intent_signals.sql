-- Type-2 leads: Reddit / HN intent signals (buying + problem + competitor mentions)

CREATE TABLE IF NOT EXISTS intent_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  platform TEXT NOT NULL,
  signal_type TEXT NOT NULL,

  title TEXT NOT NULL,
  body TEXT,
  url TEXT NOT NULL,
  author TEXT,
  subreddit TEXT,
  engagement_score INTEGER,

  relevance_score INTEGER,
  why_relevant TEXT,
  suggested_response TEXT,
  response_platform TEXT,
  urgency TEXT,

  matched_keywords TEXT[] DEFAULT '{}',

  status TEXT NOT NULL DEFAULT 'new',
  responded_at TIMESTAMPTZ,
  response_notes TEXT,

  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_intent_signals_user_url ON intent_signals(user_id, url);
CREATE INDEX IF NOT EXISTS idx_intent_user_discovered ON intent_signals(user_id, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_user_status ON intent_signals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_intent_user_type ON intent_signals(user_id, signal_type);

ALTER TABLE intent_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intent_signals_select" ON intent_signals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "intent_signals_insert" ON intent_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "intent_signals_update" ON intent_signals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "intent_signals_delete" ON intent_signals
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE intent_signals IS 'CRO intent scanner: Reddit/HN threads scored for ICP + helpful reply drafts';
