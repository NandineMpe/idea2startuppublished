-- Content intelligence feed (Founder Brand -> Public Presence)

create table if not exists content_briefings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_at timestamptz not null default now(),
  angle text,
  summary text not null,
  top_hook text not null,
  connections text[] not null default '{}',
  story_count integer not null default 0,
  breaking_count integer not null default 0
);

create index if not exists idx_content_briefings_user_generated
  on content_briefings(user_id, generated_at desc);

create table if not exists content_stories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  briefing_id text references content_briefings(id) on delete set null,
  url text not null,
  title text not null,
  source text not null,
  tier integer not null,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  snippet text not null default '',
  pillar text not null,
  urgency text not null,
  content_score integer not null default 1,
  hook text not null default '',
  key_quote text,
  why_it_matters text not null default '',
  connected_topics text[] not null default '{}',
  named_people text[] not null default '{}',
  named_companies text[] not null default '{}',
  named_numbers text[] not null default '{}',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  unique(user_id, url)
);

create index if not exists idx_content_stories_user_published
  on content_stories(user_id, published_at desc);
create index if not exists idx_content_stories_user_pillar
  on content_stories(user_id, pillar);
create index if not exists idx_content_stories_user_status
  on content_stories(user_id, status);
create index if not exists idx_content_stories_user_score
  on content_stories(user_id, content_score desc);

alter table content_briefings enable row level security;
alter table content_stories enable row level security;

drop policy if exists "content_briefings_owner_all" on content_briefings;
create policy "content_briefings_owner_all"
  on content_briefings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "content_stories_owner_all" on content_stories;
create policy "content_stories_owner_all"
  on content_stories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
