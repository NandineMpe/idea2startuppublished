-- Editable 90-day priorities and risks on context page (also loadable from onboarding extraction when null)
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS priorities JSONB DEFAULT '[]'::jsonb;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS risks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN company_profile.priorities IS '90-day priority lines (JSON array of strings)';
COMMENT ON COLUMN company_profile.risks IS 'Risk lines (JSON array of strings)';
