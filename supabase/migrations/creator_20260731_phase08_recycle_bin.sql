-- Everything on the desk needs a way off it, and one of those ways has to be
-- reversible.
--
-- Two verbs, kept distinct because they mean different things to the agents:
--
--   archive  — handled. The row stays visible to the do-not-repeat lists, so an
--              archived thesis or a shelved move is not proposed again next week.
--   delete   — this should not have existed. deleted_at is stamped, the row
--              leaves every screen and every dedupe list, and it sits in
--              Recently deleted for a retention window before it is purged.
--
-- Soft delete rather than a hard one because these rows are not recoverable by
-- re-running anything: a story is a synthesis over signals that have since aged
-- out of the window, and a draft is a generation that will never come back the
-- same way. That is the opposite of the corpus, where a hard delete is correct
-- because re-importing the URL restores every field.

alter table creator.creator_work
  add column if not exists deleted_at timestamptz;

alter table creator.creator_stories
  add column if not exists deleted_at timestamptz;

-- 'archived' on work mirrors what phase 7 gave stories. Reusing 'done' would
-- have been cheaper and would have lied: the Desk reports 'done' as work the
-- agents completed overnight, not work the creator shelved.
alter table creator.creator_work
  drop constraint if exists creator_work_state_check;

alter table creator.creator_work
  add constraint creator_work_state_check
  check (state in ('proposed', 'approved', 'active', 'done', 'killed', 'archived'));

-- Partial indexes: the bin is a small set read on one screen, while every other
-- query wants the live rows. Indexing only the deleted rows keeps the bin lookup
-- cheap without adding a second index to the hot paths.
create index if not exists creator_work_user_deleted_idx
  on creator.creator_work (user_id, deleted_at desc)
  where deleted_at is not null;

create index if not exists creator_stories_user_deleted_idx
  on creator.creator_stories (user_id, deleted_at desc)
  where deleted_at is not null;
