-- Optional metadata for ai_outputs (e.g. tech radar timestamps)
ALTER TABLE ai_outputs ADD COLUMN IF NOT EXISTS metadata JSONB;
