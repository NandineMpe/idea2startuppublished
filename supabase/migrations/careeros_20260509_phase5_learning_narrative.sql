-- CareerOS Phase 5: narrative engine + generated outputs
-- Depends on:
--   - careeros_20260509_phase1_foundations_identity_skill_graph.sql
--   - careeros_20260509_phase2_market_intelligence.sql
--   - careeros_20260509_phase3_trajectory_forecasting.sql
--   - careeros_20260509_phase4_company_layoff_intelligence.sql

create schema if not exists careeros;

grant usage on schema careeros to authenticated;
grant usage on schema careeros to service_role;

-- ---------------------------------------------------------------------------
-- User-scoped narrative and generated artefact tables
-- ---------------------------------------------------------------------------

create table if not exists careeros.user_narrative_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  narrative_type text not null,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  content_markdown text not null,
  narrative_payload jsonb not null default '{}'::jsonb,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_user_narrative_documents_unique_key unique (user_id, narrative_type, version)
);

create unique index if not exists careeros_user_narrative_documents_current_unique_idx
  on careeros.user_narrative_documents(user_id, narrative_type)
  where is_current = true;

create index if not exists careeros_user_narrative_documents_user_type_version_idx
  on careeros.user_narrative_documents(user_id, narrative_type, version desc);

create table if not exists careeros.user_generated_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  output_type text not null check (
    output_type in ('resume_variant', 'linkedin_about', 'short_bio', 'long_bio', 'jd_fit_pitch')
  ),
  source_narrative_id uuid references careeros.user_narrative_documents(id) on delete set null,
  version integer not null check (version > 0),
  is_current boolean not null default true,
  content_text text not null,
  output_payload jsonb not null default '{}'::jsonb,
  model_version text not null,
  prompt_version text not null,
  schema_version text not null,
  input_data_version text not null,
  source_attribution jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint careeros_user_generated_outputs_unique_key unique (user_id, output_type, version)
);

create unique index if not exists careeros_user_generated_outputs_current_unique_idx
  on careeros.user_generated_outputs(user_id, output_type)
  where is_current = true;

create index if not exists careeros_user_generated_outputs_user_type_version_idx
  on careeros.user_generated_outputs(user_id, output_type, version desc);

create index if not exists careeros_user_generated_outputs_source_narrative_idx
  on careeros.user_generated_outputs(source_narrative_id);

-- ---------------------------------------------------------------------------
-- RLS + policies
-- ---------------------------------------------------------------------------

alter table careeros.user_narrative_documents enable row level security;
alter table careeros.user_generated_outputs enable row level security;

grant select, insert, update, delete on careeros.user_narrative_documents to authenticated;
grant select, insert, update, delete on careeros.user_generated_outputs to authenticated;

drop policy if exists "users manage own careeros user_narrative_documents" on careeros.user_narrative_documents;
create policy "users manage own careeros user_narrative_documents"
  on careeros.user_narrative_documents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own careeros user_generated_outputs" on careeros.user_generated_outputs;
create policy "users manage own careeros user_generated_outputs"
  on careeros.user_generated_outputs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Trigger attachments
-- ---------------------------------------------------------------------------

drop trigger if exists careeros_user_narrative_documents_set_updated_at on careeros.user_narrative_documents;
create trigger careeros_user_narrative_documents_set_updated_at
before update on careeros.user_narrative_documents
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_user_generated_outputs_set_updated_at on careeros.user_generated_outputs;
create trigger careeros_user_generated_outputs_set_updated_at
before update on careeros.user_generated_outputs
for each row execute function careeros.set_updated_at();
