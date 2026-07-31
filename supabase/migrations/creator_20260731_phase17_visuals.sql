-- Visual direction, planned against the documents the story already stands on.
--
-- A script from this desk is unusual in one respect: every claim in it is
-- backed by a primary document with a URL. That makes the strongest possible
-- visual free — the filing itself on screen, the paragraph highlighted, the
-- docket number readable. Generic visual advice cannot do that, because generic
-- advice has no receipts to point at.
--
-- The plan is stored on the draft rather than in its own table because it is
-- one per draft and gets regenerated rather than versioned; a creator asking
-- for another take wants a replacement, not a history.

alter table creator.creator_work
  add column if not exists visual_plan jsonb;

-- What the creator actually owns, declared rather than assumed.
--
-- The planner has to route each beat to a tool. Guessing which tools they have
-- produces a plan full of things they cannot make, and the same mistake as
-- inferring their market from their content: the model will happily invent a
-- capable-sounding stack and every shot in it would be unbuildable.
--
-- [{name, url, good_for}]
alter table creator.creator_settings
  add column if not exists visual_tools jsonb not null default '[]'::jsonb;
