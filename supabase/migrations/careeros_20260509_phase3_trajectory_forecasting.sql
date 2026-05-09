-- CareerOS Phase 3: trajectory + forecasting + user intelligence artefacts
-- Depends on:
--   - careeros_20260509_phase1_foundations_identity_skill_graph.sql
--   - careeros_20260509_phase2_market_intelligence.sql

create schema if not exists careeros;

grant usage on schema careeros to authenticated;
grant usage on schema careeros to service_role;

-- ---------------------------------------------------------------------------
-- Shared market forecasting table
-- ---------------------------------------------------------------------------

create table if not exists careeros.market_emerging_roles (
  id uuid primary key default gen_random_uuid(),
  onet_soc_code text not null,
  region_code text not null,
  window_code text not null,
  emergence_score numeric(8,4) not null,
  rank_position integer not null,
  signals_payload jsonb not null default '{}'::jsonb,
  source_dataset_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_market_emerging_roles_unique_key unique (
    onet_soc_code,
    region_code,
    window_code,
    source_dataset_version
  )
);

create index if not exists careeros_market_emerging_roles_region_window_rank_idx
  on careeros.market_emerging_roles(region_code, window_code, rank_position);

-- ---------------------------------------------------------------------------
-- User-scoped Phase 3 artefact tables
-- ---------------------------------------------------------------------------

create table if not exists careeros.user_ai_feed_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feed_type text not null,
  feed_at timestamptz not null,
  title text not null,
  item_payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  dismissed_at timestamptz,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists careeros_user_ai_feed_items_user_feed_at_idx
  on careeros.user_ai_feed_items(user_id, feed_at desc);
create index if not exists careeros_user_ai_feed_items_user_read_feed_at_idx
  on careeros.user_ai_feed_items(user_id, is_read, feed_at desc);
create index if not exists careeros_user_ai_feed_items_user_dismissed_idx
  on careeros.user_ai_feed_items(user_id, dismissed_at);

create table if not exists careeros.user_skill_half_life (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_skill_id uuid not null references careeros.user_skills(id) on delete cascade,
  calculated_for_date date not null,
  half_life_days numeric(10,2) not null,
  confidence_score numeric(5,4),
  factors_payload jsonb not null default '{}'::jsonb,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_user_skill_half_life_unique_key unique (user_skill_id, calculated_for_date, schema_version)
);

create index if not exists careeros_user_skill_half_life_user_date_idx
  on careeros.user_skill_half_life(user_id, calculated_for_date desc);
create index if not exists careeros_user_skill_half_life_skill_date_idx
  on careeros.user_skill_half_life(user_skill_id, calculated_for_date desc);

create table if not exists careeros.user_career_health_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_year integer not null,
  report_quarter integer not null check (report_quarter between 1 and 4),
  version integer not null check (version > 0),
  is_current boolean not null default true,
  score_overall numeric(6,2),
  report_payload jsonb not null default '{}'::jsonb,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_user_career_health_reports_unique_key unique (user_id, report_year, report_quarter, version)
);

create unique index if not exists careeros_user_career_health_reports_current_unique_idx
  on careeros.user_career_health_reports(user_id, report_year, report_quarter)
  where is_current = true;

create index if not exists careeros_user_career_health_reports_user_period_idx
  on careeros.user_career_health_reports(user_id, report_year desc, report_quarter desc);

-- ---------------------------------------------------------------------------
-- RLS + policies for user-scoped Phase 3 tables
-- ---------------------------------------------------------------------------

alter table careeros.user_ai_feed_items enable row level security;
alter table careeros.user_skill_half_life enable row level security;
alter table careeros.user_career_health_reports enable row level security;

grant select, insert, update, delete on careeros.user_ai_feed_items to authenticated;
grant select, insert, update, delete on careeros.user_skill_half_life to authenticated;
grant select, insert, update, delete on careeros.user_career_health_reports to authenticated;

drop policy if exists "users manage own careeros user_ai_feed_items" on careeros.user_ai_feed_items;
create policy "users manage own careeros user_ai_feed_items"
  on careeros.user_ai_feed_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_skill_half_life" on careeros.user_skill_half_life;
create policy "users manage own careeros user_skill_half_life"
  on careeros.user_skill_half_life for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_career_health_reports" on careeros.user_career_health_reports;
create policy "users manage own careeros user_career_health_reports"
  on careeros.user_career_health_reports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Trigger attachments
-- ---------------------------------------------------------------------------

drop trigger if exists careeros_market_emerging_roles_set_updated_at on careeros.market_emerging_roles;
create trigger careeros_market_emerging_roles_set_updated_at
before update on careeros.market_emerging_roles
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_ai_feed_items_set_updated_at on careeros.user_ai_feed_items;
create trigger careeros_user_ai_feed_items_set_updated_at
before update on careeros.user_ai_feed_items
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_skill_half_life_set_updated_at on careeros.user_skill_half_life;
create trigger careeros_user_skill_half_life_set_updated_at
before update on careeros.user_skill_half_life
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_career_health_reports_set_updated_at on careeros.user_career_health_reports;
create trigger careeros_user_career_health_reports_set_updated_at
before update on careeros.user_career_health_reports
for each row execute function careeros.set_updated_at();
