-- Module 2.3 foundations: synonym map + richer skill velocity metrics.

create table if not exists careeros.skill_synonyms (
  synonym_key text primary key,
  canonical_skill_key text not null,
  confidence numeric(5,4) not null default 1.0,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists careeros_skill_synonyms_canonical_idx
  on careeros.skill_synonyms(canonical_skill_key);

alter table careeros.skill_synonyms enable row level security;
grant select on careeros.skill_synonyms to authenticated;
drop policy if exists "users read skill synonyms" on careeros.skill_synonyms;
create policy "users read skill synonyms"
  on careeros.skill_synonyms for select
  using (true);

alter table careeros.market_skill_velocity
  add column if not exists mention_count integer not null default 0,
  add column if not exists prior_window_mention_count integer;

alter table careeros.market_skill_velocity
  drop constraint if exists careeros_market_skill_velocity_direction_check;

alter table careeros.market_skill_velocity
  add constraint careeros_market_skill_velocity_direction_check
  check (direction in ('growing', 'declining', 'flat', 'new'));

create index if not exists careeros_market_skill_velocity_region_velocity_idx
  on careeros.market_skill_velocity(region_code, window_end desc, velocity_score desc);

drop trigger if exists careeros_skill_synonyms_set_updated_at on careeros.skill_synonyms;
create trigger careeros_skill_synonyms_set_updated_at
before update on careeros.skill_synonyms
for each row execute function careeros.set_updated_at();
