-- Flag user skills that could not be mapped to O*NET (demo / QA / downstream filters).

alter table careeros.user_skills
  add column if not exists onet_needs_review boolean not null default false;

create index if not exists careeros_user_skills_needs_review_idx
  on careeros.user_skills (user_id, onet_needs_review)
  where is_active = true and onet_needs_review = true;

comment on column careeros.user_skills.onet_needs_review is
  'True when O*NET mapping was skipped, low confidence, or flagged as novel by Claude.';
