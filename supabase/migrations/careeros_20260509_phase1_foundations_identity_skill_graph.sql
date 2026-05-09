-- CareerOS Phase 1: foundations + identity + skill graph + ops audit
-- Integrated into the existing Juno Supabase migration flow.

-- Extensions required for CareerOS.
create extension if not exists pgcrypto;
create extension if not exists vector;
create extension if not exists pg_trgm;

-- Dedicated CareerOS schema.
create schema if not exists careeros;

-- Allow authenticated clients to access CareerOS user-scoped tables
-- (row visibility is still enforced by RLS).
grant usage on schema careeros to authenticated;
grant usage on schema careeros to service_role;

-- Reusable updated_at trigger in CareerOS schema.
create or replace function careeros.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Core identity/profile tables
-- ---------------------------------------------------------------------------

create table if not exists careeros.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  current_role_title text,
  target_role_title text,
  location_label text,
  location_region_code text,
  years_experience numeric(4,1) check (years_experience >= 0),
  employer_input text,
  -- FK to careeros.company_profiles is added in Phase 4.
  employer_company_id uuid,
  onet_soc_code text,
  onet_mapping_confidence numeric(5,4),
  onet_mapping_payload jsonb not null default '{}'::jsonb,
  profile_completeness_score numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists careeros_user_profiles_onet_soc_code_idx
  on careeros.user_profiles(onet_soc_code);
create index if not exists careeros_user_profiles_location_region_code_idx
  on careeros.user_profiles(location_region_code);
create index if not exists careeros_user_profiles_employer_company_id_idx
  on careeros.user_profiles(employer_company_id);

create table if not exists careeros.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  notification_preferences jsonb not null default '{}'::jsonb,
  region_override_code text,
  privacy_preferences jsonb not null default '{}'::jsonb,
  onboarding_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists careeros.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('resume', 'linkedin')),
  version integer not null check (version > 0),
  storage_bucket text not null default 'careeros-documents',
  storage_path text not null,
  text_hash text not null,
  content_mime_type text,
  content_bytes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_user_documents_user_type_version_key unique (user_id, doc_type, version),
  constraint careeros_user_documents_user_type_hash_key unique (user_id, doc_type, text_hash)
);

create index if not exists careeros_user_documents_user_type_version_idx
  on careeros.user_documents(user_id, doc_type, version desc);

create table if not exists careeros.user_document_extractions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_document_id uuid not null references careeros.user_documents(id) on delete cascade,
  parser_name text not null,
  parser_version text not null,
  extraction_version integer not null check (extraction_version > 0),
  is_current boolean not null default true,
  parsed_payload jsonb not null default '{}'::jsonb,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_doc_extract_doc_parser_version_key unique (user_document_id, parser_name, extraction_version)
);

create unique index if not exists careeros_doc_extract_current_unique_idx
  on careeros.user_document_extractions(user_document_id, parser_name)
  where is_current = true;

create index if not exists careeros_doc_extract_user_doc_idx
  on careeros.user_document_extractions(user_id, user_document_id);

create index if not exists careeros_doc_extract_parsed_payload_gin_idx
  on careeros.user_document_extractions using gin(parsed_payload);

create table if not exists careeros.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  canonical_skill_key text not null,
  skill_name text not null,
  proficiency_score numeric(5,2) check (proficiency_score between 0 and 100),
  proficiency_band text,
  evidence_payload jsonb not null default '[]'::jsonb,
  source_type text not null check (source_type in ('resume', 'linkedin', 'manual', 'inferred')),
  is_active boolean not null default true,
  onet_skill_id text,
  onet_mapping_confidence numeric(5,4),
  onet_mapping_payload jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists careeros_user_skills_active_unique_idx
  on careeros.user_skills(user_id, canonical_skill_key)
  where is_active = true;

create index if not exists careeros_user_skills_user_active_idx
  on careeros.user_skills(user_id, is_active);
create index if not exists careeros_user_skills_canonical_skill_key_idx
  on careeros.user_skills(canonical_skill_key);
create index if not exists careeros_user_skills_onet_skill_id_idx
  on careeros.user_skills(onet_skill_id);

create table if not exists careeros.user_skill_embeddings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_skill_id uuid not null references careeros.user_skills(id) on delete cascade,
  embedding_model text not null default 'text-embedding-3-small',
  embedding_dim integer not null default 1536 check (embedding_dim = 1536),
  embedding vector(1536) not null,
  embedding_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_user_skill_embeddings_skill_version_key unique (user_skill_id, embedding_version)
);

create index if not exists careeros_user_skill_embeddings_user_id_idx
  on careeros.user_skill_embeddings(user_id);
create index if not exists careeros_user_skill_embeddings_hnsw_idx
  on careeros.user_skill_embeddings using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Operational tables (mandatory in Phase 1)
-- ---------------------------------------------------------------------------

create table if not exists careeros.generation_runs (
  id uuid not null default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  artefact_table text not null,
  artefact_id uuid,
  workflow_name text not null,
  provider text not null check (provider in ('anthropic', 'qwen', 'other')),
  model_name text not null,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  input_hash text not null,
  output_hash text,
  token_usage jsonb,
  latency_ms integer,
  status text not null,
  error_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, created_at)
) partition by range (created_at);

-- Safe default partition so inserts never fail if a monthly partition was missed.
create table if not exists careeros.generation_runs_default
  partition of careeros.generation_runs default;

create index if not exists careeros_generation_runs_created_at_idx
  on careeros.generation_runs(created_at desc);
create index if not exists careeros_generation_runs_workflow_created_idx
  on careeros.generation_runs(workflow_name, created_at desc);
create index if not exists careeros_generation_runs_artefact_idx
  on careeros.generation_runs(artefact_table, artefact_id);
create index if not exists careeros_generation_runs_user_created_idx
  on careeros.generation_runs(user_id, created_at desc);

create table if not exists careeros.generation_runs_summary (
  id uuid primary key default gen_random_uuid(),
  month_start date not null,
  workflow_name text not null,
  model_name text not null,
  provider text not null,
  status text not null,
  runs_count bigint not null default 0,
  total_tokens bigint not null default 0,
  error_rate numeric(8,6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_generation_runs_summary_unique_key unique (month_start, workflow_name, model_name, provider, status)
);

create index if not exists careeros_generation_runs_summary_month_idx
  on careeros.generation_runs_summary(month_start, workflow_name, model_name);

create table if not exists careeros.cache_refresh_runs (
  id uuid primary key default gen_random_uuid(),
  dataset_key text not null,
  workflow_name text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  status text not null,
  rows_processed integer not null default 0,
  rows_inserted integer not null default 0,
  rows_updated integer not null default 0,
  rows_skipped integer not null default 0,
  data_source_version text not null,
  freshness_window daterange not null,
  run_stats jsonb not null default '{}'::jsonb,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists careeros_cache_refresh_runs_dataset_started_idx
  on careeros.cache_refresh_runs(dataset_key, started_at desc);
create index if not exists careeros_cache_refresh_runs_status_started_idx
  on careeros.cache_refresh_runs(status, started_at desc);

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------

alter table careeros.user_profiles enable row level security;
alter table careeros.user_settings enable row level security;
alter table careeros.user_documents enable row level security;
alter table careeros.user_document_extractions enable row level security;
alter table careeros.user_skills enable row level security;
alter table careeros.user_skill_embeddings enable row level security;
alter table careeros.generation_runs enable row level security;

-- Authenticated table grants for user-scoped CareerOS tables.
grant select, insert, update, delete on careeros.user_profiles to authenticated;
grant select, insert, update, delete on careeros.user_settings to authenticated;
grant select, insert, update, delete on careeros.user_documents to authenticated;
grant select, insert, update, delete on careeros.user_document_extractions to authenticated;
grant select, insert, update, delete on careeros.user_skills to authenticated;
grant select, insert, update, delete on careeros.user_skill_embeddings to authenticated;

-- generation_runs is service-only; do not expose to anon/authenticated.
revoke all on careeros.generation_runs from anon, authenticated;

drop policy if exists "users manage own careeros user_profiles" on careeros.user_profiles;
create policy "users manage own careeros user_profiles"
  on careeros.user_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_settings" on careeros.user_settings;
create policy "users manage own careeros user_settings"
  on careeros.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_documents" on careeros.user_documents;
create policy "users manage own careeros user_documents"
  on careeros.user_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_document_extractions" on careeros.user_document_extractions;
create policy "users manage own careeros user_document_extractions"
  on careeros.user_document_extractions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_skills" on careeros.user_skills;
create policy "users manage own careeros user_skills"
  on careeros.user_skills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_skill_embeddings" on careeros.user_skill_embeddings;
create policy "users manage own careeros user_skill_embeddings"
  on careeros.user_skill_embeddings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Explicit deny policy for authenticated users on generation_runs.
-- Service role bypasses RLS and remains operational.
drop policy if exists "deny authenticated generation_runs access" on careeros.generation_runs;
create policy "deny authenticated generation_runs access"
  on careeros.generation_runs
  for all
  to authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- Trigger attachments
-- ---------------------------------------------------------------------------

drop trigger if exists careeros_user_profiles_set_updated_at on careeros.user_profiles;
create trigger careeros_user_profiles_set_updated_at
before update on careeros.user_profiles
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_settings_set_updated_at on careeros.user_settings;
create trigger careeros_user_settings_set_updated_at
before update on careeros.user_settings
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_documents_set_updated_at on careeros.user_documents;
create trigger careeros_user_documents_set_updated_at
before update on careeros.user_documents
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_document_extractions_set_updated_at on careeros.user_document_extractions;
create trigger careeros_user_document_extractions_set_updated_at
before update on careeros.user_document_extractions
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_skills_set_updated_at on careeros.user_skills;
create trigger careeros_user_skills_set_updated_at
before update on careeros.user_skills
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_skill_embeddings_set_updated_at on careeros.user_skill_embeddings;
create trigger careeros_user_skill_embeddings_set_updated_at
before update on careeros.user_skill_embeddings
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_generation_runs_set_updated_at on careeros.generation_runs;
create trigger careeros_generation_runs_set_updated_at
before update on careeros.generation_runs
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_generation_runs_summary_set_updated_at on careeros.generation_runs_summary;
create trigger careeros_generation_runs_summary_set_updated_at
before update on careeros.generation_runs_summary
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_cache_refresh_runs_set_updated_at on careeros.cache_refresh_runs;
create trigger careeros_cache_refresh_runs_set_updated_at
before update on careeros.cache_refresh_runs
for each row execute function careeros.set_updated_at();
