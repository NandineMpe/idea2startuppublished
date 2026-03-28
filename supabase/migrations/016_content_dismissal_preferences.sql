-- Dismissal reasons on calendar rows + append-only log for CMO learning

ALTER TABLE content_calendar
  ADD COLUMN IF NOT EXISTS dismissal_reason TEXT;

COMMENT ON COLUMN content_calendar.dismissal_reason IS 'Why the founder skipped this item (human-readable)';

CREATE TABLE IF NOT EXISTS content_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_calendar_id UUID REFERENCES content_calendar(id) ON DELETE SET NULL,
  ai_output_id UUID,
  reason_preset TEXT,
  reason_detail TEXT,
  reason_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- If an older `content_preferences` table already existed, CREATE TABLE IF NOT EXISTS was skipped — align columns before indexes
ALTER TABLE content_preferences ADD COLUMN IF NOT EXISTS content_calendar_id UUID REFERENCES content_calendar(id) ON DELETE SET NULL;
ALTER TABLE content_preferences ADD COLUMN IF NOT EXISTS ai_output_id UUID;
ALTER TABLE content_preferences ADD COLUMN IF NOT EXISTS reason_preset TEXT;
ALTER TABLE content_preferences ADD COLUMN IF NOT EXISTS reason_detail TEXT;
ALTER TABLE content_preferences ADD COLUMN IF NOT EXISTS reason_text TEXT;
UPDATE content_preferences SET reason_text = COALESCE(reason_text, '') WHERE reason_text IS NULL;
ALTER TABLE content_preferences ALTER COLUMN reason_text SET NOT NULL;
ALTER TABLE content_preferences ALTER COLUMN reason_text SET DEFAULT '';

ALTER TABLE content_preferences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_content_prefs_user_created ON content_preferences(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_prefs_ai_output ON content_preferences(user_id, ai_output_id);

ALTER TABLE content_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_preferences_select" ON content_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "content_preferences_insert" ON content_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE content_preferences IS 'Founder dismissals — last N feed into CMO system prompt';
COMMENT ON COLUMN content_preferences.reason_preset IS 'wrong_tone | not_relevant | too_salesy | bad_timing | say_differently | custom';
COMMENT ON COLUMN content_preferences.reason_detail IS 'Optional free-text addition';
COMMENT ON COLUMN content_preferences.reason_text IS 'Full line stored for prompts and analytics';
