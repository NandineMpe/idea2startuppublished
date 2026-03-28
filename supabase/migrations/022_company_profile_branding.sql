-- Voice & messaging agents consume via getCompanyContext() prompt block
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_voice TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_promise TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_never_say TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_proof_points TEXT;

COMMENT ON COLUMN company_profile.brand_voice IS 'How the company sounds — tone, personality, register (feeds content agents)';
COMMENT ON COLUMN company_profile.brand_promise IS 'One-line outcome or belief to anchor hooks and headlines';
COMMENT ON COLUMN company_profile.brand_never_say IS 'Phrases, clichés, or positioning to avoid';
COMMENT ON COLUMN company_profile.brand_proof_points IS 'Facts, metrics, or quotes agents may cite';
