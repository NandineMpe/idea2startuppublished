-- Intelligence Preview Shares: public read-only share links that expose only
-- the Intelligence Feed (daily brief + behavioral + intent + security) for a
-- specific account (user_id + optional organization_id + optional workspace_id)
-- to an unauthenticated viewer.
--
-- The slug is the unguessable path segment in the public URL:
--   /preview/intelligence/<slug>
--
-- Only the service role (supabaseAdmin) reads/writes this table. Nothing here
-- is user-facing through RLS; the public route uses the service client.

create table if not exists intelligence_preview_shares (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  -- The account whose ai_outputs / intent_signals should be exposed.
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  workspace_id uuid references client_workspaces(id) on delete set null,
  -- Display label (what the viewer sees in the header).
  label text not null,
  -- Feature flags. Default: show the full intelligence feed.
  show_signal_feed boolean not null default true,
  show_security_alerts boolean not null default true,
  show_behavioral boolean not null default true,
  show_intent_signals boolean not null default true,
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60)
);

create index if not exists intelligence_preview_shares_slug_idx
  on intelligence_preview_shares(slug)
  where is_active = true;

create index if not exists intelligence_preview_shares_user_idx
  on intelligence_preview_shares(user_id);

alter table intelligence_preview_shares enable row level security;

-- Only the creator can see their shares via RLS; the public read path uses
-- the service role client and bypasses RLS by design.
drop policy if exists "creators manage their intelligence preview shares"
  on intelligence_preview_shares;
create policy "creators manage their intelligence preview shares"
  on intelligence_preview_shares for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);
