-- ============================================================
-- Client workspaces: scope each workspace to an organization.
-- Prevents cross-team workspace selection bleed.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'Missing table public.organizations. Run organization migrations first.';
  END IF;
END
$$;

ALTER TABLE public.client_workspaces
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_client_workspaces_organization_id
  ON public.client_workspaces(organization_id);

CREATE INDEX IF NOT EXISTS idx_client_workspaces_owner_org
  ON public.client_workspaces(owner_user_id, organization_id);

-- Backfill legacy rows to each owner's personal organization where available.
WITH personal_org AS (
  SELECT DISTINCT ON (created_by_user_id)
    created_by_user_id AS user_id,
    id AS organization_id
  FROM public.organizations
  WHERE is_personal = true
  ORDER BY created_by_user_id, created_at ASC
)
UPDATE public.client_workspaces cw
SET organization_id = po.organization_id
FROM personal_org po
WHERE cw.organization_id IS NULL
  AND cw.owner_user_id = po.user_id;
