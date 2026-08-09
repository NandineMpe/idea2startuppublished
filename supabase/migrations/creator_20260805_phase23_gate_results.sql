-- The gate result on every candidate, including the ones that passed.
--
-- phase21 stored a prose sentence on failures only, which answers "why did this
-- one die" and nothing else. The question worth answering is which field fails
-- most often across a month, because that is what tells you which lanes to
-- reweight, and you want that data before touching the lane mix rather than
-- after.
--
-- gate      the structured answer: {actor, stakes, unknown_count,
--           open_question, stance_ok, hook_line}. Written whether or not it
--           passed, so the denominator exists.
-- gate_field  which check failed, null when it passed. Countable.
alter table creator.creator_stories
  add column if not exists gate jsonb,
  add column if not exists gate_field text;

alter table creator.creator_stories
  drop constraint if exists creator_stories_gate_field_check;
alter table creator.creator_stories
  add constraint creator_stories_gate_field_check
  check (gate_field is null or gate_field in (
    'actor', 'stakes', 'unknowns', 'open_question', 'stance', 'hook'
  ));

-- Partial on failures: the passing rows are the common case and nobody groups
-- by a column that is null for most of the table.
create index if not exists creator_stories_gate_field_idx
  on creator.creator_stories (user_id, gate_field, created_at desc)
  where gate_field is not null;
