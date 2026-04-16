-- ============================================================
-- Scope intent_signals and ai_outputs to organization_id.
-- Without this, all accounts sharing a user_id bleed Reddit
-- signals and behavioral summaries across organizations.
-- ============================================================

-- ── intent_signals ──────────────────────────────────────────

ALTER TABLE public.intent_signals
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill: assign each signal to the user's personal org.
UPDATE public.intent_signals s
SET organization_id = o.id
FROM public.organizations o
WHERE o.created_by_user_id = s.user_id
  AND o.is_personal = TRUE
  AND s.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_intent_signals_org_discovered
  ON public.intent_signals(organization_id, discovered_at DESC);

CREATE INDEX IF NOT EXISTS idx_intent_signals_org_platform
  ON public.intent_signals(organization_id, platform);

-- Drop old user-only unique index and replace with org-scoped one
-- so the same URL can appear in two orgs without conflict.
DROP INDEX IF EXISTS idx_intent_signals_user_url;
CREATE UNIQUE INDEX IF NOT EXISTS idx_intent_signals_org_url
  ON public.intent_signals(organization_id, url)
  WHERE organization_id IS NOT NULL;

-- ── ai_outputs ───────────────────────────────────────────────

ALTER TABLE public.ai_outputs
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill
UPDATE public.ai_outputs a
SET organization_id = o.id
FROM public.organizations o
WHERE o.created_by_user_id = a.user_id
  AND o.is_personal = TRUE
  AND a.organization_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_outputs_org_created
  ON public.ai_outputs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_org_tool
  ON public.ai_outputs(organization_id, tool);
