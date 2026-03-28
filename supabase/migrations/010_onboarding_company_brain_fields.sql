-- Structured + strategy fields used by onboarding extraction and getCompanyContext()
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS company_description TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS vertical TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS business_model TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS thesis TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS differentiators TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS icp JSONB DEFAULT '[]'::jsonb;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS competitors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS keywords JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN company_profile.company_description IS '2–3 sentence company framing (onboarding / context)';
COMMENT ON COLUMN company_profile.vertical IS 'Industry vertical';
COMMENT ON COLUMN company_profile.business_model IS 'How the company makes money';
COMMENT ON COLUMN company_profile.thesis IS 'Why this, why now — founder thesis';
COMMENT ON COLUMN company_profile.differentiators IS 'What makes them different';
COMMENT ON COLUMN company_profile.icp IS 'Ideal customer profile lines (JSON array of strings)';
COMMENT ON COLUMN company_profile.competitors IS 'Competitor names (JSON array of strings)';
COMMENT ON COLUMN company_profile.keywords IS 'Topics/keywords to monitor (JSON array of strings)';
