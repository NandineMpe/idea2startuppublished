-- Repair incomplete content_preferences (partial / legacy table missing columns)
-- Safe to run even if 016 already applied fully (IF NOT EXISTS / idempotent steps)

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

COMMENT ON COLUMN content_preferences.reason_preset IS 'wrong_tone | not_relevant | too_salesy | bad_timing | say_differently | custom';
COMMENT ON COLUMN content_preferences.reason_detail IS 'Optional free-text addition';
COMMENT ON COLUMN content_preferences.reason_text IS 'Full line stored for prompts and analytics';
