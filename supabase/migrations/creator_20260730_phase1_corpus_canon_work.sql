-- Creator OS Phase 1: corpus, canon, agent work, settings, and the Researcher's
-- signal graph. Mirrors the careeros schema conventions (dedicated schema,
-- set_updated_at trigger, RLS with auth.uid() = user_id policies).
--
-- Column names and check constraints follow the UI contract in lib/creator/types.ts;
-- that file is the spec, this migration is its storage.

create extension if not exists pgcrypto;
create extension if not exists vector;

create schema if not exists creator;

grant usage on schema creator to authenticated;
grant usage on schema creator to service_role;

create or replace function creator.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Corpus — what the creator actually published. Ground truth.
-- ---------------------------------------------------------------------------

create table if not exists creator.creator_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'tiktok'
    check (platform in ('tiktok')),
  external_id text not null,
  url text,
  caption text,
  transcript text,
  transcript_status text not null default 'pending'
    check (transcript_status in ('pending', 'running', 'done', 'failed', 'unavailable')),
  posted_at timestamptz not null,
  duration_seconds integer check (duration_seconds >= 0),
  -- {views, likes, comments, shares}; null until captured at least once.
  metrics jsonb,
  metrics_captured_at timestamptz,
  -- Assigned during canon derivation; ids live inside creator_canon jsonb, so no FK.
  pillar_id text,
  format_id text,
  -- Which ingestion path produced this row (tiktok-export, manual-url, tiktok-display-api).
  source_adapter text not null default 'tiktok-export',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, external_id)
);

create index if not exists creator_content_user_posted_idx
  on creator.creator_content (user_id, posted_at desc);
create index if not exists creator_content_transcript_status_idx
  on creator.creator_content (user_id, transcript_status);

-- ---------------------------------------------------------------------------
-- Canon — who the creator is, derived from the corpus. Versioned, never edited.
-- ---------------------------------------------------------------------------

create table if not exists creator.creator_canon (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  derived_at timestamptz not null default now(),
  corpus_size integer not null check (corpus_size >= 0),
  confidence text not null
    check (confidence in ('insufficient', 'low', 'usable', 'strong')),
  -- CreatorPillar[], CreatorFormat[], CreatorVoice, CreatorTopic[] from lib/creator/types.ts.
  pillars jsonb not null default '[]'::jsonb,
  formats jsonb not null default '[]'::jsonb,
  voice jsonb,
  topics jsonb not null default '[]'::jsonb,
  model_version text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, version)
);

create index if not exists creator_canon_user_version_idx
  on creator.creator_canon (user_id, version desc);

-- ---------------------------------------------------------------------------
-- Work — what the agents produced. Every row traces back to real posts via provenance.
-- ---------------------------------------------------------------------------

create table if not exists creator.creator_work (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'event' is ahead of the TS union on purpose: the Opportunities agent lands soon.
  kind text not null check (kind in ('draft', 'insight', 'deal', 'event')),
  state text not null default 'proposed'
    check (state in ('proposed', 'approved', 'active', 'done', 'killed')),
  autonomy text not null check (autonomy in ('auto', 'approve', 'escalate')),
  title text not null,
  body text,
  rationale text,
  -- {agent, canon_version, source_post_ids} — WorkProvenance.
  provenance jsonb not null default '{}'::jsonb,
  -- Draft-only columns, null for other kinds.
  format_id text,
  pillar_id text,
  hook text,
  estimated_duration_seconds integer check (estimated_duration_seconds >= 0),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists creator_work_user_created_idx
  on creator.creator_work (user_id, created_at desc);
create index if not exists creator_work_user_kind_state_idx
  on creator.creator_work (user_id, kind, state);

-- ---------------------------------------------------------------------------
-- Settings — the few inputs not derived from the corpus.
-- ---------------------------------------------------------------------------

create table if not exists creator.creator_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  currency text not null default 'USD'
    check (currency in ('USD', 'ZAR', 'GBP', 'EUR')),
  cpm_low numeric(8,2) not null default 20 check (cpm_low > 0),
  cpm_high numeric(8,2) not null default 40 check (cpm_high > 0),
  tiktok_handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cpm_high >= cpm_low)
);

-- ---------------------------------------------------------------------------
-- Signal graph — the Researcher's corkboard. Signals are raw dots; stories are
-- connected dots with receipts. A story that cannot cite at least two independent
-- signals (or a signal plus the creator's own corpus) stays in 'watchlist' and
-- never reaches the Desk.
-- ---------------------------------------------------------------------------

create table if not exists creator.creator_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  source_item_id text not null,
  title text not null,
  url text,
  published_at timestamptz,
  snippet text,
  -- {people: [], companies: [], numbers: []} extracted at ingest.
  entities jsonb not null default '{}'::jsonb,
  -- Discrete factual claims the synthesis passes match and contradict against.
  claims jsonb not null default '[]'::jsonb,
  topics text[] not null default '{}',
  embedding vector(1536),
  raw_payload jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_key, source_item_id)
);

create index if not exists creator_signals_user_published_idx
  on creator.creator_signals (user_id, published_at desc);
create index if not exists creator_signals_embedding_idx
  on creator.creator_signals using hnsw (embedding vector_cosine_ops);

create table if not exists creator.creator_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'watchlist'
    check (state in ('watchlist', 'proposed', 'approved', 'killed', 'published')),
  -- The unique claim. A headline restated is not a thesis.
  thesis text not null,
  synthesis_kind text not null
    check (synthesis_kind in ('connection', 'contradiction', 'second_order', 'trend_break', 'own_content')),
  -- [{signal_id, url, quote}] — what makes the thesis stand up.
  receipts jsonb not null default '[]'::jsonb,
  signal_ids uuid[] not null default '{}',
  why_now text,
  -- Canon fit: which pillar, why this creator's audience cares.
  why_you text,
  -- Suggested angle written in the creator's derived voice.
  angle text,
  canon_version integer,
  suggested_pillar_id text,
  suggested_format_id text,
  -- Set when the story is promoted to the Desk as a creator_work insight.
  work_item_id uuid references creator.creator_work(id) on delete set null,
  model_version text,
  prompt_version text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists creator_stories_user_state_idx
  on creator.creator_stories (user_id, state, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists creator_content_set_updated_at on creator.creator_content;
create trigger creator_content_set_updated_at
before update on creator.creator_content
for each row execute function creator.set_updated_at();

drop trigger if exists creator_canon_set_updated_at on creator.creator_canon;
create trigger creator_canon_set_updated_at
before update on creator.creator_canon
for each row execute function creator.set_updated_at();

drop trigger if exists creator_work_set_updated_at on creator.creator_work;
create trigger creator_work_set_updated_at
before update on creator.creator_work
for each row execute function creator.set_updated_at();

drop trigger if exists creator_settings_set_updated_at on creator.creator_settings;
create trigger creator_settings_set_updated_at
before update on creator.creator_settings
for each row execute function creator.set_updated_at();

drop trigger if exists creator_signals_set_updated_at on creator.creator_signals;
create trigger creator_signals_set_updated_at
before update on creator.creator_signals
for each row execute function creator.set_updated_at();

drop trigger if exists creator_stories_set_updated_at on creator.creator_stories;
create trigger creator_stories_set_updated_at
before update on creator.creator_stories
for each row execute function creator.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

alter table creator.creator_content enable row level security;
alter table creator.creator_canon enable row level security;
alter table creator.creator_work enable row level security;
alter table creator.creator_settings enable row level security;
alter table creator.creator_signals enable row level security;
alter table creator.creator_stories enable row level security;

grant select, insert, update, delete on creator.creator_content to authenticated;
grant select, insert, update, delete on creator.creator_canon to authenticated;
grant select, insert, update, delete on creator.creator_work to authenticated;
grant select, insert, update, delete on creator.creator_settings to authenticated;
grant select, insert, update, delete on creator.creator_signals to authenticated;
grant select, insert, update, delete on creator.creator_stories to authenticated;

grant all on creator.creator_content to service_role;
grant all on creator.creator_canon to service_role;
grant all on creator.creator_work to service_role;
grant all on creator.creator_settings to service_role;
grant all on creator.creator_signals to service_role;
grant all on creator.creator_stories to service_role;

drop policy if exists "users manage own creator content" on creator.creator_content;
create policy "users manage own creator content"
  on creator.creator_content for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own creator canon" on creator.creator_canon;
create policy "users manage own creator canon"
  on creator.creator_canon for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own creator work" on creator.creator_work;
create policy "users manage own creator work"
  on creator.creator_work for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own creator settings" on creator.creator_settings;
create policy "users manage own creator settings"
  on creator.creator_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own creator signals" on creator.creator_signals;
create policy "users manage own creator signals"
  on creator.creator_signals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own creator stories" on creator.creator_stories;
create policy "users manage own creator stories"
  on creator.creator_stories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
