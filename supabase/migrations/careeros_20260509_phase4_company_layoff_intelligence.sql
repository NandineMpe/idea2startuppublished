-- CareerOS Phase 4: company intelligence + layoff signals
-- Depends on:
--   - careeros_20260509_phase1_foundations_identity_skill_graph.sql
--   - careeros_20260509_phase2_market_intelligence.sql
--   - careeros_20260509_phase3_trajectory_forecasting.sql

create schema if not exists careeros;

grant usage on schema careeros to authenticated;
grant usage on schema careeros to service_role;

-- ---------------------------------------------------------------------------
-- Shared company profile cache
-- ---------------------------------------------------------------------------

create table if not exists careeros.company_profiles (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  name_normalised text not null,
  domain text,
  industry_key text,
  hq_region_code text,
  size_band text,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_company_profiles_name_normalised_unique_key unique (name_normalised)
);

create index if not exists careeros_company_profiles_industry_key_idx
  on careeros.company_profiles(industry_key);

-- Phase 4 decision: trigram indexes created when company intelligence begins.
create index if not exists careeros_company_profiles_name_normalised_trgm_idx
  on careeros.company_profiles using gin (name_normalised gin_trgm_ops);
create index if not exists careeros_company_profiles_canonical_name_trgm_idx
  on careeros.company_profiles using gin (canonical_name gin_trgm_ops);

-- Add deferred FK from Phase 1 profile table.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'careeros_user_profiles_employer_company_id_fkey'
  ) then
    alter table careeros.user_profiles
      add constraint careeros_user_profiles_employer_company_id_fkey
      foreign key (employer_company_id)
      references careeros.company_profiles(id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Shared layoff signal table
-- ---------------------------------------------------------------------------

create table if not exists careeros.market_layoff_signals (
  id uuid primary key default gen_random_uuid(),
  signal_scope text not null check (signal_scope in ('company', 'industry')),
  company_profile_id uuid references careeros.company_profiles(id) on delete set null,
  industry_key text,
  region_code text,
  signal_date date not null,
  severity_score numeric(8,4) not null,
  signal_count integer,
  signals_payload jsonb not null default '{}'::jsonb,
  source_dataset_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_market_layoff_signals_scope_check
    check (
      (signal_scope = 'company' and company_profile_id is not null and industry_key is null) or
      (signal_scope = 'industry' and industry_key is not null)
    )
);

create index if not exists careeros_market_layoff_signals_company_date_idx
  on careeros.market_layoff_signals(company_profile_id, signal_date desc);
create index if not exists careeros_market_layoff_signals_industry_date_idx
  on careeros.market_layoff_signals(industry_key, signal_date desc);
create index if not exists careeros_market_layoff_signals_region_date_idx
  on careeros.market_layoff_signals(region_code, signal_date desc);

-- ---------------------------------------------------------------------------
-- Trigger attachments
-- ---------------------------------------------------------------------------

drop trigger if exists careeros_company_profiles_set_updated_at on careeros.company_profiles;
create trigger careeros_company_profiles_set_updated_at
before update on careeros.company_profiles
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_market_layoff_signals_set_updated_at on careeros.market_layoff_signals;
create trigger careeros_market_layoff_signals_set_updated_at
before update on careeros.market_layoff_signals
for each row execute function careeros.set_updated_at();
