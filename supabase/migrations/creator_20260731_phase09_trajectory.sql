-- Trajectory — where the creator is going, as a first-class object.
--
-- The canon is a DESCRIPTION of the corpus, and every agent has been reading it
-- as an INSTRUCTION. Research topics come from canon topics, opportunities are
-- matched against the pillars a past post landed in, moves are argued from
-- current numbers. Nothing in the schema represented intent, so the whole desk
-- optimised for coherence with the past, and coherence with the past is exactly
-- what makes a creator plateau.
--
-- This is the second pole. Canon says who you are. Trajectory says who you are
-- becoming, in the creator's own words, plus a strategy derived against it. The
-- agents reason about the GAP between the two rather than about the canon alone.

create table if not exists creator.creator_trajectory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),

  -- Declared by the creator. Never overwritten by an agent.
  north_star text not null,
  target_audience text,
  -- What the position is FOR. A creator building a company needs a different
  -- audience than one selling ad reads, and it changes what a good deal is.
  what_it_serves text,
  horizon_months integer not null default 12 check (horizon_months between 1 and 60),
  positions_to_claim text[] not null default '{}',
  off_strategy text[] not null default '{}',

  -- Derived by the strategist. Null until the first run.
  position_now text,
  -- [{gap, why_it_matters, closes_with}]
  gaps jsonb not null default '[]'::jsonb,
  -- [{phase, months, objective, plays[]}]
  sequence jsonb not null default '[]'::jsonb,
  proof_needed text[] not null default '{}',
  -- Where the target audience actually is, which is rarely where the creator is.
  rooms text[] not null default '{}',
  -- The sharp one: what current, well-performing content is off-trajectory.
  stop_doing text[] not null default '{}',
  -- Search queries for where they are GOING. Feeds the sweep as its own stance,
  -- so the Researcher stops looking only where the corpus already points.
  search_territory text[] not null default '{}',

  strategy_derived_at timestamptz,
  model_version text,
  prompt_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, version)
);

create index if not exists creator_trajectory_user_version_idx
  on creator.creator_trajectory (user_id, version desc);

-- A third stance. 'core' is ground the creator owns, 'adjacent' is the stretch
-- next to it, and both are derived from the corpus. 'horizon' is territory the
-- creator named in their trajectory and may have no published work in at all,
-- which is the entire point of it.
alter table creator.creator_signals
  drop constraint if exists creator_signals_stance_check;

alter table creator.creator_signals
  add constraint creator_signals_stance_check
  check (stance in ('core', 'adjacent', 'horizon'));

-- And a third move. consolidate deepens owned ground, expand stretches sideways,
-- advance moves the creator toward the position they said they want to hold.
alter table creator.creator_stories
  drop constraint if exists creator_stories_move_check;

alter table creator.creator_stories
  add constraint creator_stories_move_check
  check (move in ('consolidate', 'expand', 'advance'));

drop trigger if exists creator_trajectory_set_updated_at on creator.creator_trajectory;
create trigger creator_trajectory_set_updated_at
before update on creator.creator_trajectory
for each row execute function creator.set_updated_at();

alter table creator.creator_trajectory enable row level security;

grant select, insert, update, delete on creator.creator_trajectory to authenticated;
grant all on creator.creator_trajectory to service_role;

drop policy if exists "users manage own creator trajectory" on creator.creator_trajectory;
create policy "users manage own creator trajectory"
  on creator.creator_trajectory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
