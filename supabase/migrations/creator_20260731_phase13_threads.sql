-- Threads — the things that have not finished happening yet.
--
-- Every other part of this desk is organised around a window: what moved in the
-- last 72 hours, what was filed this quarter. That is the same clock everyone
-- else is on, and a creator who only reads it can only ever be one of the
-- voices reacting to today.
--
-- A thread is the opposite unit. It is something that was reported at a point in
-- time and is not over: a lawsuit that was filed, a rule that was proposed, a
-- firm that was caught, a claim the creator made on camera. The interesting
-- question is not what happened today but what happened to THAT, and almost
-- nobody goes back to ask, because the news cycle has no mechanism for it.
--
-- The primary source lanes are what make this possible. Coverage is a snapshot
-- and does not update; a docket gets new filings, a proposed rule becomes final
-- or dies, a patent application is granted or abandoned, a comment period
-- closes and the responses are published, next year's 10-K rewrites the risk
-- factor. Those are checkable states, so "what happened next" becomes a query
-- rather than a memory.

create table if not exists creator.creator_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- What is being tracked, in one line.
  subject text not null,
  -- What to search to check on it. Written for the primary lanes, not for a
  -- news index.
  query text not null,

  origin text not null default 'manual'
    check (origin in ('corpus', 'story', 'signal', 'manual')),
  -- creator_content.id, creator_stories.id, or null. No FK: a thread must
  -- outlive the post that started it, which is the entire point.
  origin_ref uuid,

  -- When this was reported, or when the creator covered it. Everything the
  -- resurfacing pass searches is dated after this.
  anchor_date timestamptz not null,
  -- The state of the world at anchor_date, so a development can be judged
  -- against what was actually known then rather than against nothing.
  what_was_known text not null,
  -- What would count as movement. Written when the thread opens, so the check
  -- cannot quietly redefine success later.
  open_questions text[] not null default '{}',

  state text not null default 'watching'
    check (state in ('watching', 'moved', 'dormant', 'closed')),

  -- [{checked_at, moved, summary, significance, receipts:[{title,url,published_at,quote}]}]
  developments jsonb not null default '[]'::jsonb,

  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  check_count integer not null default 0,
  -- Set when a development is significant enough to be worth a post.
  work_item_id uuid references creator.creator_work(id) on delete set null,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_threads_user_state_idx
  on creator.creator_threads (user_id, state, next_check_at)
  where deleted_at is null;

create index if not exists creator_threads_due_idx
  on creator.creator_threads (next_check_at)
  where deleted_at is null and state in ('watching', 'moved');

drop trigger if exists creator_threads_set_updated_at on creator.creator_threads;
create trigger creator_threads_set_updated_at
before update on creator.creator_threads
for each row execute function creator.set_updated_at();

alter table creator.creator_threads enable row level security;

grant select, insert, update, delete on creator.creator_threads to authenticated;
grant all on creator.creator_threads to service_role;

drop policy if exists "users manage own creator threads" on creator.creator_threads;
create policy "users manage own creator threads"
  on creator.creator_threads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
