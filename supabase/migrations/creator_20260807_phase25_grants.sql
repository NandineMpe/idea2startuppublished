-- Grants, and a deadline to go with them.
--
-- The desk hunted sponsors, events and marketplaces: money that arrives in
-- exchange for the audience. It never hunted money that arrives in exchange for
-- the work, which is a different market with different eligibility, and one the
-- creator is squarely inside as an Ireland-based individual with a declared US
-- and EU reach.
--
-- 'grant' is its own kind rather than a flavour of 'deal' because the decision
-- is not the same decision. A deal is a rate negotiation and can wait a week. A
-- grant is a deadline and an application, and missing the date is the entire
-- loss.
--
-- This migration OWNS the kind constraint. phase06 widened it to add 'move' and
-- applies before this file, so the widened list has to be restated here in full
-- or the older, narrower version wins on the next run. That has already gone
-- wrong twice on the research lane checks.
alter table creator.creator_work
  drop constraint if exists creator_work_kind_check;
alter table creator.creator_work
  add constraint creator_work_kind_check
  check (kind in ('draft', 'insight', 'deal', 'event', 'move', 'grant'));

-- The date the opportunity stops existing. Null for open-ended things like a
-- marketplace listing or a standing announcement.
alter table creator.creator_work
  add column if not exists deadline date;

-- Sorted ascending on the screen, so the thing closing soonest is at the top.
create index if not exists creator_work_deadline_idx
  on creator.creator_work (user_id, deadline)
  where deadline is not null and deleted_at is null;
