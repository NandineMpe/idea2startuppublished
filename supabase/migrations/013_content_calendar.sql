-- Content calendar: scheduled + unscheduled posts across channels (CMO/CTO/CRO + manual)

CREATE TABLE IF NOT EXISTS content_calendar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  title TEXT,
  body TEXT NOT NULL,
  channel TEXT NOT NULL,
  content_type TEXT NOT NULL,

  scheduled_date DATE,
  scheduled_time TIME,

  status TEXT NOT NULL DEFAULT 'draft',

  source TEXT,
  source_ref TEXT,

  angle TEXT,
  target_audience TEXT,
  notes TEXT,
  posted_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_calendar_select" ON content_calendar
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "content_calendar_insert" ON content_calendar
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "content_calendar_update" ON content_calendar
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "content_calendar_delete" ON content_calendar
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_content_cal_user_date ON content_calendar(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_content_cal_status ON content_calendar(user_id, status);
CREATE INDEX IF NOT EXISTS idx_content_cal_source_ref ON content_calendar(user_id, source_ref);

CREATE TRIGGER set_content_calendar_updated_at
  BEFORE UPDATE ON content_calendar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE content_calendar IS 'Founder content calendar — draft/approved/posted; agents populate via service role';
