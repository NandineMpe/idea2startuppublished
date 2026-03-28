-- Lookalike engine: weighted profiles, outreach outcomes, optional link to ai_outputs.
--
-- Requires public.ai_outputs for the FK below. If that table does not exist yet, run your
-- project's migration that creates it first (e.g. 001_initial_schema.sql in this repo), then
-- re-run this file — the DO block will add the column once ai_outputs exists.

CREATE TABLE IF NOT EXISTS lookalike_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  segment_tag TEXT,
  created_from_conversion_id UUID,
  dimensions JSONB NOT NULL,
  outreach_playbook JSONB NOT NULL,
  stats JSONB NOT NULL DEFAULT '{"totalGenerated":0,"totalContacted":0,"replies":0,"meetings":0,"closed":0,"outcomeCountAtLastRefine":0}'::jsonb,
  queries_cache JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lookalike_profiles_user_active
  ON lookalike_profiles(user_id, is_active, updated_at DESC);

ALTER TABLE lookalike_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lookalike profiles"
  ON lookalike_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS lookalike_outreach_outcomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES lookalike_profiles(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'contacted',
    'no_response',
    'replied',
    'meeting',
    'closed_won',
    'closed_lost',
    'not_icp'
  )),
  actual_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  channel TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lookalike_outcomes_profile
  ON lookalike_outreach_outcomes(profile_id, created_at DESC);

ALTER TABLE lookalike_outreach_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own lookalike outcomes"
  ON lookalike_outreach_outcomes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only when ai_outputs exists (some DBs never ran the migration that creates it).
DO $lookalike_ai_outputs$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ai_outputs'
  ) THEN
    ALTER TABLE public.ai_outputs
      ADD COLUMN IF NOT EXISTS lookalike_profile_id UUID REFERENCES lookalike_profiles(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_ai_outputs_lookalike_profile
      ON public.ai_outputs (lookalike_profile_id)
      WHERE lookalike_profile_id IS NOT NULL;
  END IF;
END
$lookalike_ai_outputs$;
