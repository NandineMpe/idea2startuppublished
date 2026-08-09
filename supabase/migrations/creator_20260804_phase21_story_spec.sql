-- The story spec: candidate gate fields, and the fields that replace why_you.
--
-- The gate is applied at research time. A candidate that cannot fill these is a
-- research brief, not a video, and no amount of scripting rescues it later. So
-- the fields are stored on the story rather than derived in the writer: they are
-- what the candidate had to prove to exist at all.
--
-- named_actor  — someone did something. A document is not an actor.
-- stakes       — who loses, who is embarrassed, who changes what, by when.
--                The boredom gate. Without it there is no emotion downstream.
-- open_question— what the card genuinely cannot answer. Curiosity runs on it.
-- hook_line    — one sentence, sayable to someone who reads nothing.
--
-- why_you is deliberately NOT dropped. It argued the story against the strategy
-- doc after the fact, which is a compliance check rather than a reason, so
-- nothing writes it any more and no screen shows it. Dropping the column would
-- destroy the rationale on every story filed before today, and a stored column
-- nobody reads costs nothing.
alter table creator.creator_stories
  add column if not exists named_actor    text,
  add column if not exists stakes         text,
  add column if not exists open_question  text,
  add column if not exists hook_line      text,
  -- Replaces why_you. Both are things the desk is supposed to hand over
  -- honestly rather than argue past.
  add column if not exists unknowns       text,
  add column if not exists kill_reason    text,
  -- One only. Knowledge is the home lane: knowing something and feeling you
  -- learned it is what earns completion and the send-to-a-friend.
  add column if not exists primary_emotion text,
  -- Some good material is a byline and a bad video. Tagging it stops a routing
  -- error from reading as a personal failure.
  add column if not exists output_format  text not null default 'script';

-- Constraints are dropped before being added so this file stays idempotent, and
-- because the runner reapplies every migration on every run. IMPORTANT: any
-- later migration that widens either list must own the constraint itself, or the
-- narrower version here will be reapplied on top of it and start rejecting rows
-- the newer code writes. That has already gone wrong twice on the lane checks.
alter table creator.creator_stories
  drop constraint if exists creator_stories_primary_emotion_check;
alter table creator.creator_stories
  add constraint creator_stories_primary_emotion_check
  check (primary_emotion is null or primary_emotion in (
    'knowledge', 'amusement', 'jolt', 'admiration', 'inspiration', 'craving', 'calm'
  ));

alter table creator.creator_stories
  drop constraint if exists creator_stories_output_format_check;
alter table creator.creator_stories
  add constraint creator_stories_output_format_check
  check (output_format in ('script', 'written', 'artifact'));

-- The named argument the whole strategy rests on, promoted to its own column.
--
-- It was previously buried inside a gap's closes_with prose, which meant no
-- agent could score against it: the pipeline was ranking candidates against the
-- format list instead, and fetching instances of formats. The strategy named
-- formats as a means to the argument, so the argument has to be retrievable on
-- its own for anything to outrank them.
alter table creator.creator_trajectory
  add column if not exists flagship_question text;

-- Stories that failed the gate are worth keeping and worth seeing: the reason a
-- candidate died is the clearest description of what the desk is looking for.
alter table creator.creator_stories
  add column if not exists gate_failure text;

create index if not exists creator_stories_output_format_idx
  on creator.creator_stories (user_id, output_format)
  where deleted_at is null;
