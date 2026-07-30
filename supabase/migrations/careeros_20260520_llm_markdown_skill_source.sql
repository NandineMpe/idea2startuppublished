-- Treat LLM markdown career profiles as first-class document sources (not inferred placeholders).

alter table careeros.user_skills
  drop constraint if exists user_skills_source_type_check;

alter table careeros.user_skills
  drop constraint if exists careeros_user_skills_source_type_check;

alter table careeros.user_skills
  add constraint careeros_user_skills_source_type_check
  check (source_type in ('resume', 'linkedin', 'manual', 'inferred', 'llm_markdown'));

alter table careeros.user_skills
  drop constraint if exists careeros_user_skills_portfolio_source_check;

alter table careeros.user_skills
  add constraint careeros_user_skills_portfolio_source_check
  check (
    not is_active
    or is_placeholder
    or source_type in ('resume', 'linkedin', 'manual', 'llm_markdown')
  );

drop index if exists careeros_user_skills_portfolio_idx;

create index if not exists careeros_user_skills_portfolio_idx
  on careeros.user_skills (user_id, skill_name)
  where is_active = true
    and is_placeholder = false
    and source_type in ('resume', 'linkedin', 'manual', 'llm_markdown');

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
  and s.source_type in ('resume', 'linkedin', 'manual', 'llm_markdown');

grant select on careeros.v_user_portfolio_skills to authenticated;
grant select on careeros.v_user_portfolio_skills to service_role;
