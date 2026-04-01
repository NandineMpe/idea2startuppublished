-- Outreach provider tracking: support AgentMail (thread/message ids) while keeping legacy Resend rows.

ALTER TABLE outreach_log
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_inbox_id TEXT;

UPDATE outreach_log
SET
  provider = COALESCE(provider, 'resend'),
  provider_message_id = COALESCE(provider_message_id, resend_message_id)
WHERE resend_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_provider_message
  ON outreach_log (provider, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_provider_thread
  ON outreach_log (provider, provider_thread_id)
  WHERE provider_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_provider_inbox
  ON outreach_log (provider, provider_inbox_id)
  WHERE provider_inbox_id IS NOT NULL;
