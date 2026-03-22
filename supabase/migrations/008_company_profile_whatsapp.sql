-- WhatsApp delivery — per-user number on company_profile (E.164, no whatsapp: prefix)
ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

ALTER TABLE company_profile
  ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN company_profile.whatsapp_number IS 'E.164 e.g. +353861234567; Twilio adds whatsapp: prefix when sending';
COMMENT ON COLUMN company_profile.whatsapp_verified IS 'True after test message succeeds (sandbox joined or production sender)';
