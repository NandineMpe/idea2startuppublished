-- ============================================================
-- Slug format guards (3-50 chars, lowercase alnum + hyphen).
-- Adds constraints only when existing rows already comply.
-- ============================================================

DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.organizations
      WHERE slug IS NULL
         OR char_length(slug) < 3
         OR char_length(slug) > 50
         OR slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ) THEN
      RAISE NOTICE 'Skipping organizations slug check constraint due to legacy rows.';
    ELSIF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'organizations_slug_format_check'
    ) THEN
      ALTER TABLE public.organizations
        ADD CONSTRAINT organizations_slug_format_check
        CHECK (
          char_length(slug) BETWEEN 3 AND 50
          AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        );
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.client_workspaces') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.client_workspaces
      WHERE slug IS NULL
         OR char_length(slug) < 3
         OR char_length(slug) > 50
         OR slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ) THEN
      RAISE NOTICE 'Skipping client_workspaces slug check constraint due to legacy rows.';
    ELSIF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'client_workspaces_slug_format_check'
    ) THEN
      ALTER TABLE public.client_workspaces
        ADD CONSTRAINT client_workspaces_slug_format_check
        CHECK (
          char_length(slug) BETWEEN 3 AND 50
          AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        );
    END IF;
  END IF;
END
$$;

