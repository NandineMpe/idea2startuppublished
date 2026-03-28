-- Distinguish floating Juno ("sidekick") from Context page conversations.
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'sidekick';

ALTER TABLE chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_channel_check;

ALTER TABLE chat_sessions
  ADD CONSTRAINT chat_sessions_channel_check
  CHECK (channel IN ('sidekick', 'context'));

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_channel
  ON chat_sessions (user_id, channel);

COMMENT ON COLUMN chat_sessions.channel IS 'sidekick = floating Juno widget; context = /dashboard/context update dialog';
