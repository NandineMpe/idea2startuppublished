-- Legacy/alternate column name used on some deployments (NOT NULL `preference`)
ALTER TABLE content_preferences ADD COLUMN IF NOT EXISTS preference TEXT;

UPDATE content_preferences
SET preference = COALESCE(preference, NULLIF(TRIM(reason_preset), ''), 'custom')
WHERE preference IS NULL;

ALTER TABLE content_preferences ALTER COLUMN preference SET DEFAULT 'custom';

UPDATE content_preferences SET preference = 'custom' WHERE preference IS NULL;

ALTER TABLE content_preferences ALTER COLUMN preference SET NOT NULL;

COMMENT ON COLUMN content_preferences.preference IS 'Dismissal category — mirrors preference_type / reason preset';
