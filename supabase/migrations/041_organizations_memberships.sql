-- =============================================================================
-- Organizations + memberships (shared tenant for chat + company context)
-- One user can belong to many orgs. Data is scoped by organization_id.
-- Existing rows get a personal org per legacy user_id.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_personal BOOLEAN NOT NULL DEFAULT FALSE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_created_by
  ON public.organizations(created_by_user_id);

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id
  ON public.organization_members(user_id);

-- ---------------------------------------------------------------------------
-- Add organization_id to tenant-scoped tables (nullable until backfill)
-- ---------------------------------------------------------------------------

ALTER TABLE public.company_profile
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.company_assets
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_company_profile_organization_id
  ON public.company_profile(organization_id);

CREATE INDEX IF NOT EXISTS idx_company_assets_organization_id
  ON public.company_assets(organization_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_organization_id
  ON public.chat_sessions(organization_id);

-- ---------------------------------------------------------------------------
-- Backfill: one personal org per distinct legacy user
-- ---------------------------------------------------------------------------

INSERT INTO public.organizations (slug, display_name, is_personal, created_by_user_id)
SELECT
  'u-' || REPLACE(u.user_id::TEXT, '-', ''),
  'Personal',
  TRUE,
  u.user_id
FROM (
  SELECT DISTINCT user_id FROM public.company_profile
  UNION
  SELECT DISTINCT user_id FROM public.chat_sessions
  UNION
  SELECT DISTINCT user_id FROM public.company_assets
) u
WHERE NOT EXISTS (
  SELECT 1 FROM public.organizations o
  WHERE o.created_by_user_id = u.user_id AND o.is_personal = TRUE
);

INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT o.id, o.created_by_user_id, 'owner'
FROM public.organizations o
WHERE o.is_personal = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = o.id AND m.user_id = o.created_by_user_id
  );

UPDATE public.company_profile c
SET organization_id = o.id
FROM public.organizations o
WHERE c.organization_id IS NULL
  AND o.created_by_user_id = c.user_id
  AND o.is_personal = TRUE;

UPDATE public.chat_sessions s
SET organization_id = o.id
FROM public.organizations o
WHERE s.organization_id IS NULL
  AND o.created_by_user_id = s.user_id
  AND o.is_personal = TRUE;

UPDATE public.company_assets a
SET organization_id = o.id
FROM public.organizations o
WHERE a.organization_id IS NULL
  AND o.created_by_user_id = a.user_id
  AND o.is_personal = TRUE;

-- Fail fast if something could not be linked (fix data before re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.company_profile WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'company_profile rows without organization_id after backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM public.chat_sessions WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'chat_sessions rows without organization_id after backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_assets WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'company_assets rows without organization_id after backfill';
  END IF;
END $$;

ALTER TABLE public.company_profile
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.chat_sessions
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE public.company_assets
  ALTER COLUMN organization_id SET NOT NULL;

-- Unique company profile per org (replaces one-row-per-user)
ALTER TABLE public.company_profile DROP CONSTRAINT IF EXISTS company_profile_user_id_key;

ALTER TABLE public.company_profile
  ADD CONSTRAINT company_profile_organization_id_key UNIQUE (organization_id);

-- ---------------------------------------------------------------------------
-- RLS: organizations + members (read for members only; writes via service role)
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their organizations" ON public.organizations;
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = organizations.id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can view org rosters they belong to" ON public.organization_members;
-- Own rows only: do not subquery organization_members here (that causes infinite RLS recursion).
CREATE POLICY "Members can view org rosters they belong to"
  ON public.organization_members FOR SELECT
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RLS: company_profile + company_assets (org members)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own company profile" ON public.company_profile;
DROP POLICY IF EXISTS "Users can insert own company profile" ON public.company_profile;
DROP POLICY IF EXISTS "Users can update own company profile" ON public.company_profile;
DROP POLICY IF EXISTS "Users can delete own company profile" ON public.company_profile;

CREATE POLICY "Org members can view company profile"
  ON public.company_profile FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = company_profile.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert company profile"
  ON public.company_profile FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = company_profile.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update company profile"
  ON public.company_profile FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = company_profile.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete company profile"
  ON public.company_profile FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = company_profile.organization_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own company assets" ON public.company_assets;
DROP POLICY IF EXISTS "Users can insert own company assets" ON public.company_assets;
DROP POLICY IF EXISTS "Users can update own company assets" ON public.company_assets;
DROP POLICY IF EXISTS "Users can delete own company assets" ON public.company_assets;

CREATE POLICY "Org members can view company assets"
  ON public.company_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = company_assets.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert company assets"
  ON public.company_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = company_assets.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update company assets"
  ON public.company_assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = company_assets.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete company assets"
  ON public.company_assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = company_assets.organization_id
        AND m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: chat_sessions + chat_messages (org members; messages visible in org)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete own chat sessions" ON public.chat_sessions;

CREATE POLICY "Org members can view chat sessions"
  ON public.chat_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = chat_sessions.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert chat sessions"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = chat_sessions.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update chat sessions"
  ON public.chat_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = chat_sessions.organization_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete chat sessions"
  ON public.chat_sessions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = chat_sessions.organization_id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;

CREATE POLICY "Org members can view chat messages"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      INNER JOIN public.organization_members m ON m.organization_id = s.organization_id
      WHERE s.id = chat_messages.session_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert chat messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_sessions s
      INNER JOIN public.organization_members om ON om.organization_id = s.organization_id
      WHERE s.id = chat_messages.session_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete chat messages"
  ON public.chat_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions s
      INNER JOIN public.organization_members m ON m.organization_id = s.organization_id
      WHERE s.id = chat_messages.session_id
        AND m.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.organizations TO authenticated;
GRANT SELECT ON public.organization_members TO authenticated;
