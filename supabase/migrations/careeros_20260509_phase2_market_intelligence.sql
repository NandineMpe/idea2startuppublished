-- CareerOS Phase 2: market intelligence cache + user market snapshots
-- Depends on: careeros_20260509_phase1_foundations_identity_skill_graph.sql

create schema if not exists careeros;

grant usage on schema careeros to authenticated;
grant usage on schema careeros to service_role;

-- ---------------------------------------------------------------------------
-- Shared O*NET cache tables
-- ---------------------------------------------------------------------------

create table if not exists careeros.onet_occupations_cache (
  id uuid primary key default gen_random_uuid(),
  onet_soc_code text not null,
  onet_release text not null,
  title text not null,
  description text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_onet_occupations_cache_unique_key unique (onet_soc_code, onet_release)
);

create index if not exists careeros_onet_occupations_cache_soc_idx
  on careeros.onet_occupations_cache(onet_soc_code);
create index if not exists careeros_onet_occupations_cache_release_idx
  on careeros.onet_occupations_cache(onet_release);

create table if not exists careeros.onet_skills_cache (
  id uuid primary key default gen_random_uuid(),
  onet_skill_id text not null,
  onet_release text not null,
  name text not null,
  description text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_onet_skills_cache_unique_key unique (onet_skill_id, onet_release)
);

create index if not exists careeros_onet_skills_cache_skill_idx
  on careeros.onet_skills_cache(onet_skill_id);
create index if not exists careeros_onet_skills_cache_release_idx
  on careeros.onet_skills_cache(onet_release);

-- ---------------------------------------------------------------------------
-- Shared market intelligence cache tables
-- ---------------------------------------------------------------------------

create table if not exists careeros.market_demand_trajectories (
  id uuid primary key default gen_random_uuid(),
  onet_soc_code text not null,
  region_code text not null,
  window_code text not null,
  window_start date not null,
  window_end date not null,
  demand_index numeric(8,3) not null,
  demand_delta_pct numeric(8,3),
  source_dataset_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_market_demand_unique_key unique (
    onet_soc_code,
    region_code,
    window_code,
    window_end,
    source_dataset_version
  )
);

create index if not exists careeros_market_demand_soc_region_window_end_idx
  on careeros.market_demand_trajectories(onet_soc_code, region_code, window_end desc);
create index if not exists careeros_market_demand_region_window_end_idx
  on careeros.market_demand_trajectories(region_code, window_end desc);

create table if not exists careeros.market_salary_bands (
  id uuid primary key default gen_random_uuid(),
  onet_soc_code text not null,
  seniority_band text not null,
  region_code text not null,
  currency_code text not null default 'EUR',
  salary_min numeric(12,2) not null,
  salary_mid numeric(12,2),
  salary_max numeric(12,2) not null,
  sample_size integer,
  source_dataset_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_market_salary_bands_unique_key unique (
    onet_soc_code,
    seniority_band,
    region_code,
    source_dataset_version
  )
);

create index if not exists careeros_market_salary_bands_soc_region_seniority_idx
  on careeros.market_salary_bands(onet_soc_code, region_code, seniority_band);

create table if not exists careeros.market_salary_band_overlays (
  id uuid primary key default gen_random_uuid(),
  market_salary_band_id uuid not null references careeros.market_salary_bands(id) on delete cascade,
  overlay_skill_key text not null,
  delta_pct numeric(8,4),
  salary_min_override numeric(12,2),
  salary_mid_override numeric(12,2),
  salary_max_override numeric(12,2),
  source_dataset_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_market_salary_overlay_unique_key unique (
    market_salary_band_id,
    overlay_skill_key,
    source_dataset_version
  )
);

create index if not exists careeros_market_salary_overlay_band_idx
  on careeros.market_salary_band_overlays(market_salary_band_id);
create index if not exists careeros_market_salary_overlay_skill_idx
  on careeros.market_salary_band_overlays(overlay_skill_key);

create table if not exists careeros.market_skill_velocity (
  id uuid primary key default gen_random_uuid(),
  canonical_skill_key text not null,
  region_code text not null,
  window_code text not null,
  window_start date not null,
  window_end date not null,
  velocity_score numeric(10,4) not null,
  direction text not null check (direction in ('growing', 'declining', 'flat')),
  source_dataset_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_market_skill_velocity_unique_key unique (
    canonical_skill_key,
    region_code,
    window_code,
    window_end,
    source_dataset_version
  )
);

create index if not exists careeros_market_skill_velocity_skill_region_window_end_idx
  on careeros.market_skill_velocity(canonical_skill_key, region_code, window_end desc);
create index if not exists careeros_market_skill_velocity_region_window_end_idx
  on careeros.market_skill_velocity(region_code, window_end desc);

create table if not exists careeros.market_adjacent_roles (
  id uuid primary key default gen_random_uuid(),
  source_soc_code text not null,
  target_soc_code text not null,
  similarity_method text not null,
  similarity_score numeric(8,5) not null,
  rank_position integer not null,
  source_dataset_version text not null,
  explain_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_market_adjacent_roles_unique_key unique (
    source_soc_code,
    target_soc_code,
    similarity_method,
    source_dataset_version
  )
);

create index if not exists careeros_market_adjacent_roles_source_rank_idx
  on careeros.market_adjacent_roles(source_soc_code, source_dataset_version, rank_position);
create index if not exists careeros_market_adjacent_roles_target_idx
  on careeros.market_adjacent_roles(target_soc_code);

-- ---------------------------------------------------------------------------
-- User-scoped market snapshot tables
-- ---------------------------------------------------------------------------

create table if not exists careeros.user_adjacent_role_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_role_soc_code text,
  snapshot_window_code text not null,
  generated_at timestamptz not null default now(),
  is_current boolean not null default true,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists careeros_user_adjacent_role_snapshots_current_unique_idx
  on careeros.user_adjacent_role_snapshots(user_id)
  where is_current = true;

create index if not exists careeros_user_adjacent_role_snapshots_user_generated_idx
  on careeros.user_adjacent_role_snapshots(user_id, generated_at desc);

create table if not exists careeros.user_adjacent_role_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_id uuid not null references careeros.user_adjacent_role_snapshots(id) on delete cascade,
  source_soc_code text not null,
  target_soc_code text not null,
  market_adjacent_role_id uuid references careeros.market_adjacent_roles(id) on delete set null,
  rank_position integer not null,
  personalised_fit_score numeric(8,4),
  explain_payload jsonb not null default '{}'::jsonb,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_user_adjacent_role_items_rank_unique_key unique (snapshot_id, rank_position)
);

create index if not exists careeros_user_adjacent_role_items_snapshot_rank_idx
  on careeros.user_adjacent_role_items(snapshot_id, rank_position);
create index if not exists careeros_user_adjacent_role_items_user_snapshot_idx
  on careeros.user_adjacent_role_items(user_id, snapshot_id);

create table if not exists careeros.user_market_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  briefing_week_start date not null,
  is_current boolean not null default true,
  briefing_payload jsonb not null,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_user_market_briefings_week_schema_unique_key unique (user_id, briefing_week_start, schema_version)
);

create unique index if not exists careeros_user_market_briefings_current_unique_idx
  on careeros.user_market_briefings(user_id)
  where is_current = true;

create index if not exists careeros_user_market_briefings_user_week_idx
  on careeros.user_market_briefings(user_id, briefing_week_start desc);

-- ---------------------------------------------------------------------------
-- RLS, grants, policies for user-scoped Phase 2 tables
-- ---------------------------------------------------------------------------

alter table careeros.user_adjacent_role_snapshots enable row level security;
alter table careeros.user_adjacent_role_items enable row level security;
alter table careeros.user_market_briefings enable row level security;

grant select, insert, update, delete on careeros.user_adjacent_role_snapshots to authenticated;
grant select, insert, update, delete on careeros.user_adjacent_role_items to authenticated;
grant select, insert, update, delete on careeros.user_market_briefings to authenticated;

drop policy if exists "users manage own careeros user_adjacent_role_snapshots" on careeros.user_adjacent_role_snapshots;
create policy "users manage own careeros user_adjacent_role_snapshots"
  on careeros.user_adjacent_role_snapshots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_adjacent_role_items" on careeros.user_adjacent_role_items;
create policy "users manage own careeros user_adjacent_role_items"
  on careeros.user_adjacent_role_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_market_briefings" on careeros.user_market_briefings;
create policy "users manage own careeros user_market_briefings"
  on careeros.user_market_briefings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Trigger attachments
-- ---------------------------------------------------------------------------

drop trigger if exists careeros_onet_occupations_cache_set_updated_at on careeros.onet_occupations_cache;
create trigger careeros_onet_occupations_cache_set_updated_at
before update on careeros.onet_occupations_cache
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_onet_skills_cache_set_updated_at on careeros.onet_skills_cache;
create trigger careeros_onet_skills_cache_set_updated_at
before update on careeros.onet_skills_cache
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_market_demand_trajectories_set_updated_at on careeros.market_demand_trajectories;
create trigger careeros_market_demand_trajectories_set_updated_at
before update on careeros.market_demand_trajectories
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_market_salary_bands_set_updated_at on careeros.market_salary_bands;
create trigger careeros_market_salary_bands_set_updated_at
before update on careeros.market_salary_bands
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_market_salary_band_overlays_set_updated_at on careeros.market_salary_band_overlays;
create trigger careeros_market_salary_band_overlays_set_updated_at
before update on careeros.market_salary_band_overlays
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_market_skill_velocity_set_updated_at on careeros.market_skill_velocity;
create trigger careeros_market_skill_velocity_set_updated_at
before update on careeros.market_skill_velocity
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_market_adjacent_roles_set_updated_at on careeros.market_adjacent_roles;
create trigger careeros_market_adjacent_roles_set_updated_at
before update on careeros.market_adjacent_roles
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_adjacent_role_snapshots_set_updated_at on careeros.user_adjacent_role_snapshots;
create trigger careeros_user_adjacent_role_snapshots_set_updated_at
before update on careeros.user_adjacent_role_snapshots
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_adjacent_role_items_set_updated_at on careeros.user_adjacent_role_items;
create trigger careeros_user_adjacent_role_items_set_updated_at
before update on careeros.user_adjacent_role_items
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_market_briefings_set_updated_at on careeros.user_market_briefings;
create trigger careeros_user_market_briefings_set_updated_at
before update on careeros.user_market_briefings
for each row execute function careeros.set_updated_at();
