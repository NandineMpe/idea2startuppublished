-- ============================================================
-- Seeded invites: link each invite to the seeded organization.
-- This keeps claim/preview/account hydration tenant-safe.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.organizations. Run migration 041_organizations_memberships.sql first.';
  END IF;
END
$$;

ALTER TABLE public.seeded_invites
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_seeded_invites_organization_id
  ON public.seeded_invites(organization_id);

WITH latest_org AS (
  SELECT
    si.id AS invite_id,
    (
      SELECT cp.organization_id
      FROM public.company_profile cp
      WHERE cp.user_id = si.user_id
      ORDER BY cp.updated_at DESC NULLS LAST, cp.created_at DESC
      LIMIT 1
    ) AS organization_id
  FROM public.seeded_invites si
  WHERE si.organization_id IS NULL
)
UPDATE public.seeded_invites si
SET organization_id = lo.organization_id
FROM latest_org lo
WHERE si.id = lo.invite_id
  AND lo.organization_id IS NOT NULL;
