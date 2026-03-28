-- GTM Motion: outreach queue + lead research fields

ALTER TABLE cro_leads
  ADD COLUMN IF NOT EXISTS company_domain TEXT,
  ADD COLUMN IF NOT EXISTS account_intel JSONB,
  ADD COLUMN IF NOT EXISTS research_status TEXT,
  ADD COLUMN IF NOT EXISTS researched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cro_leads_research_status ON cro_leads (user_id, research_status)
  WHERE research_status IS NOT NULL;

CREATE TABLE IF NOT EXISTS outreach_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lead_id UUID REFERENCES cro_leads (id) ON DELETE SET NULL,

  to_name TEXT NOT NULL,
  to_email TEXT NOT NULL,
  to_title TEXT,
  to_company TEXT,

  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',

  status TEXT NOT NULL DEFAULT 'drafted',
  sent_at TIMESTAMPTZ,
  resend_message_id TEXT,

  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounce_reason TEXT,

  outcome TEXT,
  outcome_notes TEXT,

  lookalike_profile_id UUID REFERENCES lookalike_profiles (id) ON DELETE SET NULL,

  scheduled_for TIMESTAMPTZ,
  skipped_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_user ON outreach_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_status ON outreach_log (user_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_resend ON outreach_log (resend_message_id)
  WHERE resend_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_outreach_lead ON outreach_log (lead_id)
  WHERE lead_id IS NOT NULL;

ALTER TABLE outreach_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own outreach"
  ON outreach_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE outreach_log IS 'Cold email drafts and sends for GTM Motion (Resend tracking).';
