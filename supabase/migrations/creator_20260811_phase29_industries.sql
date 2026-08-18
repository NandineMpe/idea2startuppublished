-- In industry: the arc, not the headline.
--
-- The research lanes were already collecting the right material. A thousand
-- signals across patents, procurement, inspections, job postings, consultations
-- and filings, and every one of them surfaced as an individual story: this
-- happened, then this happened. The corpus could say what changed on Tuesday and
-- could not say what has been happening to audit since 2023, or what the
-- registers say happens next.
--
-- That gap is the whole value of the content. Anyone can have a take on an AI
-- headline. Almost nobody can say what a 2029 audit file looks like and show the
-- patents, the tenders and the job specs that make it a forecast rather than a
-- guess.
--
-- A dossier is per industry and rebuilt rather than appended, because it is a
-- current reading of a corpus that keeps moving. The previous reading is kept in
-- built_from so a rebuild can say what actually changed, which is the part that
-- generates content.
create table if not exists creator.creator_industries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  slug text not null,
  label text not null,
  -- Who this is for, inside the industry. An audit dossier written for the
  -- general public is a different and much worse document.
  audience text,
  -- The practice as it stood before any of this. Without a baseline the arc has
  -- no first point and every change reads as though it came from nowhere.
  baseline text,

  -- The deterministic selector. Editable, because the creator knowing why a
  -- signal was included is the difference between a dossier she can defend and
  -- one she has to take on trust.
  match_terms text[] not null default '{}',

  -- Derived. Each is a flat array of objects assembled in code from the model's
  -- newline-delimited output, never handed to the model as nested JSON: a bare
  -- nested object in that schema makes the model emit its tool-call markup into
  -- the response and abandon every field after it.
  --
  -- arc        [{ era, period, claim, evidence: [{title, url, lane, published_at}] }]
  -- indicators [{ lane, band, horizon, reading, count, evidence: [...] }]
  -- shifts     [{ claim, evidence: [...] }]   what moved since the last build
  arc jsonb not null default '[]'::jsonb,
  indicators jsonb not null default '[]'::jsonb,
  shifts jsonb not null default '[]'::jsonb,

  -- The one-line state of the industry, and the questions the evidence leaves
  -- open. The open questions are the content queue: a dossier that produces no
  -- question has told her nothing she can make a video about.
  headline text,
  open_questions text[] not null default '{}',

  -- How many signals the build actually stood on, per band. A dossier built on
  -- four leading indicators and eighty news items should say so rather than
  -- read with the same confidence as one built the other way round.
  built_from jsonb not null default '{}'::jsonb,

  built_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (user_id, slug)
);

create index if not exists creator_industries_user_idx
  on creator.creator_industries (user_id, slug) where deleted_at is null;

alter table creator.creator_industries enable row level security;
grant select, insert, update on creator.creator_industries to authenticated;
grant all on creator.creator_industries to service_role;

drop policy if exists "users read own creator industries" on creator.creator_industries;
create policy "users read own creator industries"
  on creator.creator_industries for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own creator industries" on creator.creator_industries;
create policy "users insert own creator industries"
  on creator.creator_industries for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own creator industries" on creator.creator_industries;
create policy "users update own creator industries"
  on creator.creator_industries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
