-- Migration 033: Office Hours complete setup
-- Safe to run even if 031/032 were already applied.
-- Paste this entire block into Supabase SQL editor if db:migrate isn't available.

-- 1. Expand chat_sessions.channel to include 'office-hours'
alter table chat_sessions
  add column if not exists channel text not null default 'sidekick';

alter table chat_sessions
  drop constraint if exists chat_sessions_channel_check;

alter table chat_sessions
  add constraint chat_sessions_channel_check
  check (channel in ('sidekick', 'context', 'office-hours'));

-- 2. Add mode column to chat_sessions (startup | builder | null for other channels)
alter table chat_sessions
  add column if not exists mode text
  constraint chat_sessions_mode_check
  check (mode is null or mode in ('startup', 'builder'));

-- 3. Index for channel lookups
create index if not exists idx_chat_sessions_user_channel
  on chat_sessions (user_id, channel);

-- 4. design_docs table
create table if not exists design_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id uuid references chat_sessions(id) on delete set null,
  mode text check (mode in ('startup', 'builder')) not null,
  title text not null,
  doc_data jsonb not null,
  status text default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz default now()
);

create index if not exists design_docs_user_created_idx
  on design_docs(user_id, created_at desc);

alter table design_docs enable row level security;

drop policy if exists "users own their design docs" on design_docs;
create policy "users own their design docs"
  on design_docs for all using (auth.uid() = user_id);

-- 5. ceo_reviews table (from migration 030 — idempotent)
create table if not exists ceo_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  review_date date not null,
  review_data jsonb not null,
  created_at timestamptz default now()
);

create index if not exists ceo_reviews_user_date_idx
  on ceo_reviews(user_id, review_date desc);

create unique index if not exists ceo_reviews_user_date_unique
  on ceo_reviews(user_id, review_date);

alter table ceo_reviews enable row level security;

drop policy if exists "users own their ceo reviews" on ceo_reviews;
create policy "users own their ceo reviews"
  on ceo_reviews for all using (auth.uid() = user_id);
