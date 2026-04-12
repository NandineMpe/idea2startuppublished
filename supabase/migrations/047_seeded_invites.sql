-- ============================================================
-- Seeded Invites — "claim your account" outbound loop
-- One row per founder you seed + email before they sign up.
-- ============================================================

CREATE TABLE IF NOT EXISTS seeded_invites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The pre-created Supabase auth user (unconfirmed until claimed)
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Who this is for
  target_email  TEXT NOT NULL,
  target_name   TEXT,
  target_company TEXT,
  target_url    TEXT,     -- their website
  target_linkedin TEXT,   -- LinkedIn URL used for research

  -- One-time claim token (URL-safe random string)
  token         TEXT NOT NULL UNIQUE,

  -- Lifecycle
  seeded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent_at TIMESTAMPTZ,
  claimed_at    TIMESTAMPTZ,

  -- Snapshot of the 3 intelligence bullets shown in the email
  -- so we can render them without hitting the DB again
  email_preview JSONB DEFAULT '{}'::jsonb,

  -- Full synthesis stored for debugging / re-seeding
  seed_data     JSONB DEFAULT '{}'::jsonb,

  -- Who triggered the seed (your user_id as the sender/admin)
  seeded_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Only you (service role) should touch this table.
-- No RLS policies — accessed exclusively via supabaseAdmin.
ALTER TABLE seeded_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_seeded_invites_token       ON seeded_invites(token);
CREATE INDEX IF NOT EXISTS idx_seeded_invites_target_email ON seeded_invites(target_email);
CREATE INDEX IF NOT EXISTS idx_seeded_invites_claimed_at   ON seeded_invites(claimed_at);
