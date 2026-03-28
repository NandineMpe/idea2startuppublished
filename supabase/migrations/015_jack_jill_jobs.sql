-- Jobs you curate (e.g. Jack & Jill digest) — merged first in CRO lead scan
ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS jack_jill_jobs JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN company_profile.jack_jill_jobs IS 'Array of {company, title, url?, description?} from Jack & Jill or similar — scored with HN/Remotive';
