-- Voice DNA (demonstrated examples), channel rules, vocabulary tags, credibility hooks
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_voice_dna TEXT;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_channel_voice JSONB DEFAULT '{"linkedin":"","cold_email":"","reddit_hn":""}'::jsonb;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_words_use JSONB DEFAULT '[]'::jsonb;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_words_never JSONB DEFAULT '[]'::jsonb;
ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS brand_credibility_hooks JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN company_profile.brand_voice_dna IS '3–4 paragraphs of demonstrated founder voice (LinkedIn, email, Reddit samples)—not adjectives';
COMMENT ON COLUMN company_profile.brand_channel_voice IS 'Per-channel instructions: linkedin, cold_email, reddit_hn';
COMMENT ON COLUMN company_profile.brand_words_use IS 'Phrases and terms to prefer (JSON array of strings)';
COMMENT ON COLUMN company_profile.brand_words_never IS 'Banned words/phrases (JSON array of strings)';
COMMENT ON COLUMN company_profile.brand_credibility_hooks IS 'Proof points agents weave into copy (JSON array of strings)';

-- One-time backfill from legacy single text fields where present
UPDATE company_profile
SET brand_voice_dna = brand_voice
WHERE (brand_voice_dna IS NULL OR trim(brand_voice_dna) = '')
  AND brand_voice IS NOT NULL
  AND trim(brand_voice) != '';
