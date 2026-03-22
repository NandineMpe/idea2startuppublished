-- CMO / analytics: published content & relationship touches
CREATE TABLE IF NOT EXISTS ai_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_user_created ON ai_outputs(user_id, created_at DESC);

ALTER TABLE ai_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_outputs"
  ON ai_outputs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_outputs"
  ON ai_outputs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_outputs"
  ON ai_outputs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_outputs"
  ON ai_outputs FOR DELETE USING (auth.uid() = user_id);
