-- Module 3.2: Skill Half-Life Tracker
-- Extends existing tables and creates skill_ai_exposure_scores reference table

-- 1. Create skill_ai_exposure_scores (shared cache, no RLS)
CREATE TABLE IF NOT EXISTS careeros.skill_ai_exposure_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_skill_key text NOT NULL UNIQUE,
  exposure_score numeric(3,2) NOT NULL CHECK (exposure_score >= 0 AND exposure_score <= 1),
  exposure_category text NOT NULL CHECK (exposure_category IN ('low', 'medium', 'high', 'augmenting')),
  methodology_version text NOT NULL DEFAULT 'v1',
  source text NOT NULL CHECK (source IN ('eloundou_2023', 'mckinsey_2024', 'qwen_inference_v1', 'manual')),
  rationale text,
  last_reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_ai_exposure_lookup
  ON careeros.skill_ai_exposure_scores (canonical_skill_key);
CREATE INDEX IF NOT EXISTS idx_skill_ai_exposure_category
  ON careeros.skill_ai_exposure_scores (exposure_category);

-- Trigger for updated_at (uses the reusable careeros.set_updated_at defined in phase1 migration)
DROP TRIGGER IF EXISTS careeros_skill_ai_exposure_set_updated_at ON careeros.skill_ai_exposure_scores;
CREATE TRIGGER careeros_skill_ai_exposure_set_updated_at
  BEFORE UPDATE ON careeros.skill_ai_exposure_scores
  FOR EACH ROW EXECUTE FUNCTION careeros.set_updated_at();

-- Grants: shared cache, no RLS
GRANT SELECT ON careeros.skill_ai_exposure_scores TO authenticated;
GRANT ALL ON careeros.skill_ai_exposure_scores TO service_role;

-- 2. Extend user_skill_half_life with missing columns
ALTER TABLE careeros.user_skill_half_life
  ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('rising', 'stable', 'declining', 'at-risk')),
  ADD COLUMN IF NOT EXISTS confidence text CHECK (confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS half_life_months numeric(6,2),
  ADD COLUMN IF NOT EXISTS half_life_range_low_months numeric(6,2),
  ADD COLUMN IF NOT EXISTS half_life_range_high_months numeric(6,2),
  ADD COLUMN IF NOT EXISTS velocity_score_used numeric,
  ADD COLUMN IF NOT EXISTS exposure_score_used numeric(3,2),
  ADD COLUMN IF NOT EXISTS exposure_category_used text,
  ADD COLUMN IF NOT EXISTS methodology_version text NOT NULL DEFAULT 'v1';

CREATE INDEX IF NOT EXISTS idx_user_skill_half_life_status
  ON careeros.user_skill_half_life (user_id, status, calculated_for_date DESC);

-- 3. Extend user_skills with denormalised state
ALTER TABLE careeros.user_skills
  ADD COLUMN IF NOT EXISTS current_half_life_id uuid REFERENCES careeros.user_skill_half_life(id),
  ADD COLUMN IF NOT EXISTS current_status text CHECK (current_status IN ('rising', 'stable', 'declining', 'at-risk'));

CREATE INDEX IF NOT EXISTS idx_user_skills_current_status
  ON careeros.user_skills (user_id, current_status) WHERE is_active = true;
