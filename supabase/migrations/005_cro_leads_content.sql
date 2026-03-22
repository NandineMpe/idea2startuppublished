-- CRO: qualified leads + queued outreach content (service-role inserts from Inngest)
CREATE TABLE IF NOT EXISTS cro_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  url TEXT,
  icp_fit INTEGER NOT NULL,
  pitch_angle TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cro_leads_user_created ON cro_leads(user_id, created_at DESC);

ALTER TABLE cro_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cro leads"
  ON cro_leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cro leads"
  ON cro_leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cro leads"
  ON cro_leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cro leads"
  ON cro_leads FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS content_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  content_type TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_queue_user ON content_queue(user_id, created_at DESC);

ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content queue"
  ON content_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own content queue"
  ON content_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own content queue"
  ON content_queue FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own content queue"
  ON content_queue FOR DELETE USING (auth.uid() = user_id);
