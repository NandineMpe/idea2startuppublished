-- Where the creator is, and which markets they are trying to reach.
--
-- Without this the strategist infers geography from the corpus, and a corpus
-- reflects the audience the algorithm has been serving rather than the one the
-- creator wants. The first real run produced a plan built almost entirely on
-- South African institutions, for an Ireland-based creator targeting the US and
-- Europe, because those were the institutions her posts happened to mention.
-- Nothing in the schema could contradict it.
--
-- Distribution geography is also a strategy problem in its own right, not a
-- side effect of good content: a professional audience in the US and UK is
-- where the budgets are, and reaching it takes different references, different
-- regulators, different posting hours and different rooms.

alter table creator.creator_trajectory
  -- Where they actually live. Drives travel feasibility, timezone, and which
  -- market they can claim to be "local" in.
  add column if not exists based_in text,
  -- Ordered, most important first. Drives which regulators, publications,
  -- conferences and brands the desk hunts in.
  add column if not exists target_markets text[] not null default '{}',
  -- Where the audience actually is today, in the creator's words. We cannot
  -- measure this: the TikTok data we ingest carries no geographic breakdown, so
  -- if the creator does not say it, no agent can know it.
  add column if not exists audience_now text;
