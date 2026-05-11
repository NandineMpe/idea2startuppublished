-- CareerOS: weekly TheirStack posting counts for curated "frontier" job-title clusters (Module 2.x).
-- Depends on: careeros_20260509_phase2_market_intelligence.sql (schema + set_updated_at)

create table if not exists careeros.market_frontier_role_weekly (
  id uuid primary key default gen_random_uuid(),
  cluster_slug text not null,
  canonical_title text not null,
  region_code text not null,
  snapshot_week date not null,
  count_30d integer not null,
  prior_week_count_30d integer,
  growth_vs_prior_week_pct numeric(12,4),
  source_dataset_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_market_frontier_role_weekly_unique unique (
    cluster_slug,
    region_code,
    snapshot_week
  )
);

create index if not exists careeros_market_frontier_role_weekly_region_week_idx
  on careeros.market_frontier_role_weekly(region_code, snapshot_week desc);

create index if not exists careeros_market_frontier_role_weekly_cluster_region_idx
  on careeros.market_frontier_role_weekly(cluster_slug, region_code);

drop trigger if exists careeros_market_frontier_role_weekly_set_updated_at
  on careeros.market_frontier_role_weekly;
create trigger careeros_market_frontier_role_weekly_set_updated_at
  before update on careeros.market_frontier_role_weekly
  for each row execute function careeros.set_updated_at();

grant select, insert, update, delete on careeros.market_frontier_role_weekly to service_role;
