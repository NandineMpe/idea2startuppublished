-- Read the document, not the snippet.
--
-- Signals arrive as a title, a URL and 280 characters of whatever the source
-- put in its description field. That is enough to decide a thing is worth
-- reading and not enough to say anything about it, so the reading burden stayed
-- with the creator: every card was homework. This stage does the reading.
--
-- Runs only on candidates that clear the gate, because fetching and parsing a
-- 200 page PDF is the most expensive thing in the pipeline and there is no
-- point spending it on a candidate that was never going to be shot.

create table if not exists creator.creator_extracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_id uuid not null references creator.creator_signals(id) on delete cascade,

  source_url text not null,
  fetched_at timestamptz not null default now(),
  -- Of the fetched text, not the response body: a government page that stamps
  -- the current date into its footer would otherwise never look unchanged.
  content_hash text not null,
  content_chars integer not null default 0,
  media_type text,

  -- KeyClaim[]: {quote, locator, why_it_matters}
  key_claims jsonb not null default '[]'::jsonb,
  -- What the document conspicuously does NOT say. In practice this is where
  -- most of the angles come from: a vendor announcement that never mentions
  -- error rates is a story, and the absence is the evidence.
  silences jsonb not null default '[]'::jsonb,

  -- False when fewer than two claims survived verbatim verification. The row is
  -- still written: knowing a document was read and yielded nothing quotable is
  -- worth more than silently having no row, because the second is
  -- indistinguishable from never having tried.
  verified boolean not null default false,
  claims_offered integer not null default 0,
  claims_verified integer not null default 0,

  error text,
  model text,
  created_at timestamptz not null default now()
);

-- One extract per signal. A re-run updates in place rather than accumulating
-- history, because the content_hash already tells you whether anything moved.
create unique index if not exists creator_extracts_signal_idx
  on creator.creator_extracts (signal_id);

create index if not exists creator_extracts_user_created_idx
  on creator.creator_extracts (user_id, created_at desc);

-- The cache key. Government documents get re-fetched constantly by the threads
-- cron and almost never change.
create index if not exists creator_extracts_hash_idx
  on creator.creator_extracts (content_hash);

alter table creator.creator_extracts enable row level security;
grant select on creator.creator_extracts to authenticated;
grant all on creator.creator_extracts to service_role;

drop policy if exists "users read own creator extracts" on creator.creator_extracts;
create policy "users read own creator extracts"
  on creator.creator_extracts for select
  using (auth.uid() = user_id);

-- Marks a signal as having been through the extractor, so the sweep can pick up
-- where it left off without joining every time.
alter table creator.creator_signals
  add column if not exists extracted_at timestamptz;

create index if not exists creator_signals_extract_queue_idx
  on creator.creator_signals (user_id, extracted_at, ingested_at desc)
  where extracted_at is null;
