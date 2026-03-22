-- Daily brief persistence (CBS pipeline)
CREATE TABLE IF NOT EXISTS daily_briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_markdown TEXT,
  raw_item_count INT NOT NULL DEFAULT 0,
  scored_item_count INT NOT NULL DEFAULT 0,
  brief_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_date ON daily_briefs(user_id, brief_date DESC);

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily briefs"
  ON daily_briefs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily briefs"
  ON daily_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily briefs"
  ON daily_briefs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily briefs"
  ON daily_briefs FOR DELETE USING (auth.uid() = user_id);
