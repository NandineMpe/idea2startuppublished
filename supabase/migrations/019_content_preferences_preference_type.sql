-- Match production / NOT NULL: category for each dismissal row (preset id or `custom`)
ALTER TABLE content_preferences ADD COLUMN IF NOT EXISTS preference_type TEXT;

UPDATE content_preferences
SET preference_type = COALESCE(NULLIF(TRIM(reason_preset), ''), 'custom')
WHERE preference_type IS NULL;

ALTER TABLE content_preferences ALTER COLUMN preference_type SET DEFAULT 'custom';

UPDATE content_preferences SET preference_type = 'custom' WHERE preference_type IS NULL;

ALTER TABLE content_preferences ALTER COLUMN preference_type SET NOT NULL;

COMMENT ON COLUMN content_preferences.preference_type IS 'Same as reason_preset when set, else custom (free-text only)';
