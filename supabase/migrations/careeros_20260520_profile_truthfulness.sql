-- CareerOS profile truthfulness: stop placeholder/inferred skills from representing the user.
-- Pairs with app changes that remove keyword fallback skills and filter dashboard reads.
--
-- PREREQUISITE: CareerOS base schema must exist. If this file fails, run these first
-- (in order, via `supabase db push` or Supabase SQL editor):
--   1. careeros_20260509_phase1_foundations_identity_skill_graph.sql
--   2. All other careeros_20260509_* … careeros_20260520_phase3_feed_tables.sql migrations
-- Then re-run this file.

create schema if not exists careeros;

grant usage on schema careeros to authenticated;
grant usage on schema careeros to service_role;

do $careeros_prereq$
begin
  if to_regclass('careeros.user_skills') is null
    or to_regclass('careeros.user_document_extractions') is null
    or to_regclass('careeros.user_profiles') is null
  then
    raise exception using
      errcode = '42P01',
      message = 'CareerOS base tables are missing',
      hint = 'Apply careeros_20260509_phase1_foundations_identity_skill_graph.sql and prior careeros_* migrations before this file.';
  end if;
end
$careeros_prereq$;

-- ---------------------------------------------------------------------------
-- 1) Extraction quality on document extractions
-- ---------------------------------------------------------------------------

alter table careeros.user_document_extractions
  add column if not exists extraction_method text;

alter table careeros.user_document_extractions
  drop constraint if exists careeros_user_document_extractions_method_check;

alter table careeros.user_document_extractions
  add constraint careeros_user_document_extractions_method_check
  check (
    extraction_method is null
    or extraction_method in ('llm_structured', 'fallback_minimal')
  );

comment on column careeros.user_document_extractions.extraction_method is
  'How parsed_payload was produced: llm_structured (Qwen) or fallback_minimal (stated role only, no inferred skills).';

-- ---------------------------------------------------------------------------
-- 2) Skill provenance: flag placeholders, block them from active portfolio
-- ---------------------------------------------------------------------------

alter table careeros.user_skills
  add column if not exists is_placeholder boolean not null default false;

alter table careeros.user_skills
  add column if not exists provenance_workflow text;

comment on column careeros.user_skills.is_placeholder is
  'True for legacy keyword-inferred or other non-document skills; must not appear in portfolio UI.';

comment on column careeros.user_skills.provenance_workflow is
  'Inngest workflow that created the row, e.g. careeros/profile.extract.';

-- ---------------------------------------------------------------------------
-- 3) Profile readiness pointers on user_profiles
-- ---------------------------------------------------------------------------

alter table careeros.user_profiles
  add column if not exists last_profile_extraction_id uuid
    references careeros.user_document_extractions(id) on delete set null;

alter table careeros.user_profiles
  add column if not exists profile_ready_at timestamptz;

comment on column careeros.user_profiles.last_profile_extraction_id is
  'Latest careeros-profile-extract row used for skills/roles.';

comment on column careeros.user_profiles.profile_ready_at is
  'Set when extraction completed with at least one document-sourced active skill.';

create index if not exists careeros_user_profiles_last_extraction_idx
  on careeros.user_profiles (last_profile_extraction_id)
  where last_profile_extraction_id is not null;

-- ---------------------------------------------------------------------------
-- 4) Backfill: retire legacy inferred placeholder skills (before CHECK constraints)
-- ---------------------------------------------------------------------------

update careeros.user_skills
set
  is_placeholder = true,
  is_active = false,
  current_status = null,
  current_half_life_id = null,
  provenance_workflow = coalesce(provenance_workflow, 'careeros/profile.extract'),
  updated_at = now()
where source_type = 'inferred'
  and is_active = true;

update careeros.user_skills
set
  is_placeholder = true,
  is_active = false,
  updated_at = now()
where source_type = 'inferred'
  and coalesce(is_placeholder, false) = false;

-- Active portfolio rows cannot be placeholders.
alter table careeros.user_skills
  drop constraint if exists careeros_user_skills_active_not_placeholder;

alter table careeros.user_skills
  add constraint careeros_user_skills_active_not_placeholder
  check (not is_active or not is_placeholder);

-- Portfolio-facing skills must come from user documents or explicit manual entry.
alter table careeros.user_skills
  drop constraint if exists careeros_user_skills_portfolio_source_check;

alter table careeros.user_skills
  add constraint careeros_user_skills_portfolio_source_check
  check (
    not is_active
    or is_placeholder
    or source_type in ('resume', 'linkedin', 'manual')
  );

create index if not exists careeros_user_skills_portfolio_idx
  on careeros.user_skills (user_id, skill_name)
  where is_active = true
    and is_placeholder = false
    and source_type in ('resume', 'linkedin', 'manual');

-- Tag fallback extractions from zero-token generation runs (heuristic).
update careeros.user_document_extractions e
set extraction_method = 'fallback_minimal'
where e.parser_name = 'careeros-profile-extract'
  and e.extraction_method is null
  and exists (
    select 1
    from careeros.generation_runs g
    where g.artefact_id = e.id
      and g.workflow_name = 'careeros/profile.extract'
      and g.status = 'completed'
      and coalesce((g.token_usage->>'totalTokens')::int, 0) = 0
  );

update careeros.user_document_extractions e
set extraction_method = 'llm_structured'
where e.parser_name = 'careeros-profile-extract'
  and e.extraction_method is null;

-- Point profiles at latest extraction per user.
update careeros.user_profiles p
set
  last_profile_extraction_id = sub.extraction_id,
  profile_ready_at = case
    when sub.document_skill_count > 0 then sub.extraction_created_at
    else p.profile_ready_at
  end,
  updated_at = now()
from (
  select distinct on (e.user_id)
    e.user_id,
    e.id as extraction_id,
    e.created_at as extraction_created_at,
    (
      select count(*)::int
      from careeros.user_skills s
      where s.user_id = e.user_id
        and s.is_active = true
        and s.is_placeholder = false
        and s.source_type in ('resume', 'linkedin', 'manual')
    ) as document_skill_count
  from careeros.user_document_extractions e
  where e.parser_name = 'careeros-profile-extract'
  order by e.user_id, e.created_at desc
) sub
where p.user_id = sub.user_id;

-- ---------------------------------------------------------------------------
-- 5) Read model for dashboard / portfolio (security invoker = RLS on base table)
-- ---------------------------------------------------------------------------

create or replace view careeros.v_user_portfolio_skills
with (security_invoker = true)
as
select
  s.id,
  s.user_id,
  s.skill_name,
  s.canonical_skill_key,
  s.source_type,
  s.proficiency_band,
  s.current_status,
  s.current_half_life_id,
  s.provenance_workflow,
  s.last_seen_at,
  s.created_at,
  s.updated_at
from careeros.user_skills s
where s.is_active = true
  and s.is_placeholder = false
  and s.source_type in ('resume', 'linkedin', 'manual');

comment on view careeros.v_user_portfolio_skills is
  'Document-backed skills only — excludes inferred/placeholder rows.';

grant select on careeros.v_user_portfolio_skills to authenticated;
grant select on careeros.v_user_portfolio_skills to service_role;
