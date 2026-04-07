-- Explicit relevance score feedback (closes loop into future LLM scoring prompts)

ALTER TABLE intent_signals
  ADD COLUMN IF NOT EXISTS score_feedback TEXT,
  ADD COLUMN IF NOT EXISTS score_feedback_at TIMESTAMPTZ;

ALTER TABLE intent_signals DROP CONSTRAINT IF EXISTS intent_signals_score_feedback_check;

ALTER TABLE intent_signals
  ADD CONSTRAINT intent_signals_score_feedback_check
  CHECK (
    score_feedback IS NULL
    OR score_feedback IN ('too_high', 'ok', 'too_low')
  );

CREATE INDEX IF NOT EXISTS idx_intent_user_score_feedback_at
  ON intent_signals(user_id, score_feedback_at DESC)
  WHERE score_feedback IS NOT NULL;

COMMENT ON COLUMN intent_signals.score_feedback IS 'User says model relevance_score was too_high, ok, or too_low';
