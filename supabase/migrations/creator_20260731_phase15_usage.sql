-- What every agent run actually cost.
--
-- The helper was recording totalTokens only, which cannot produce a cost:
-- output tokens are priced several times higher than input, and these agents are
-- lopsided in the direction that makes the distinction matter most. Synthesis
-- sends a hundred documents and writes eight short dossiers, so it is almost all
-- input; a strategy pass is the reverse. One number cannot describe both.
--
-- Cache reads are recorded separately for the same reason: a cached input token
-- is charged at a fraction of a fresh one, and several of these prompts resend
-- a large, stable block.

create table if not exists creator.creator_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  -- Which pass: synthesise, threads.check, strategise, moves, and so on.
  agent text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  -- False when the call threw. A failed generation still burns input tokens,
  -- and a run that fails repeatedly is exactly when someone asks where the
  -- money went.
  ok boolean not null default true,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists creator_usage_user_created_idx
  on creator.creator_usage (user_id, created_at desc);

create index if not exists creator_usage_agent_idx
  on creator.creator_usage (agent, created_at desc);

alter table creator.creator_usage enable row level security;

grant select, insert on creator.creator_usage to authenticated;
grant all on creator.creator_usage to service_role;

-- Read-only to the creator: usage is a record of what happened, not something
-- to be edited after the fact.
drop policy if exists "users read own creator usage" on creator.creator_usage;
create policy "users read own creator usage"
  on creator.creator_usage for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own creator usage" on creator.creator_usage;
create policy "users insert own creator usage"
  on creator.creator_usage for insert
  with check (auth.uid() = user_id);
