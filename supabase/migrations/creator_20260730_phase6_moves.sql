-- Moves: strategic opportunities beyond the next sponsored post.
--
-- Deals and events answer "who will pay me for what I already do". A creator
-- also needs "what should I be doing that I am not" — a newsletter, a paid
-- community, an advisory seat, a syndication deal. Those are not found by
-- searching; they are argued from the creator's own evidence.
--
-- Stored as creator_work so they land on the Desk and follow the same approve
-- and kill path as everything else.

alter table creator.creator_work
  drop constraint if exists creator_work_kind_check;

alter table creator.creator_work
  add constraint creator_work_kind_check
  check (kind in ('draft', 'insight', 'deal', 'event', 'move'));

-- The plan and the thing to send, kept apart from the rationale so the UI can
-- present one to read and one to act on.
alter table creator.creator_work
  add column if not exists outline jsonb,
  add column if not exists script text;
