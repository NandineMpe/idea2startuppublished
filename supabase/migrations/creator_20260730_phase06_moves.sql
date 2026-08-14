-- Moves: strategic opportunities beyond the next sponsored post.
--
-- Deals and events answer "who will pay me for what I already do". A creator
-- also needs "what should I be doing that I am not" — a newsletter, a paid
-- community, an advisory seat, a syndication deal. Those are not found by
-- searching; they are argued from the creator's own evidence.
--
-- Stored as creator_work so they land on the Desk and follow the same approve
-- and kill path as everything else.

-- DROP ONLY. This file no longer owns the kind constraint.
--
-- The runner reapplies every migration on every run, in filename order, so this
-- file runs again long after later ones have widened the list. It used to
-- re-add ('draft','insight','deal','event','move'), which silently reverted
-- phase25's addition of 'grant' and then, once real grant rows existed, failed
-- outright and blocked the whole migration run.
--
-- The rule this cost three separate incidents to learn: the LAST migration to
-- touch a check constraint owns it, and every earlier one must be reduced to a
-- drop. Adding it here again will break the run the moment anything downstream
-- widens it.
alter table creator.creator_work
  drop constraint if exists creator_work_kind_check;

-- The plan and the thing to send, kept apart from the rationale so the UI can
-- present one to read and one to act on.
alter table creator.creator_work
  add column if not exists outline jsonb,
  add column if not exists script text;
