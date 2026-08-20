-- Industries collect their own evidence.
--
-- The screen shipped with match terms only, which quietly assumed the research
-- sweep was already reading for every industry listed. It was not. The sweep
-- takes its topics from the canon and the trajectory, and both of those are
-- about audit, finance and law, so the corpus was dense in exactly the four
-- industries that were already there and thin to empty everywhere else.
--
-- Measured before building this: across seven candidate industries the corpus
-- held real evidence for one. The other six would have produced dossiers built
-- on whatever happened to share a word with them, which is worse than an empty
-- screen because it looks like an answer.
--
-- So an industry now carries search queries as well as match terms. Match terms
-- select from what has been collected; queries go and collect. They are
-- different jobs and conflating them is what made the first version look
-- finished when it was half a feature.

alter table creator.creator_signals
  drop constraint if exists creator_signals_stance_check;

-- A fourth stance. 'industry' is material swept for a named industry rather
-- than for the creator's own topics, and it is kept distinct so the feed can
-- say why something was collected: an industry signal is not evidence that the
-- creator's niche moved, and counting it as such would inflate every reading
-- built on stance.
alter table creator.creator_signals
  add constraint creator_signals_stance_check
  check (stance in ('core', 'adjacent', 'horizon', 'industry'));

alter table creator.creator_industries
  -- Nullable rather than defaulted to '{}': a null means "inherit the seed's
  -- queries", an empty array means "she deliberately cleared them". Collapsing
  -- those two would make clearing the queries silently undoable.
  add column if not exists search_queries text[];

alter table creator.creator_industries
  -- Drives the rotation. Sweeping fourteen industries across twenty-two lanes
  -- in one run is not affordable, so each run takes the stalest few. Null sorts
  -- first, so an industry that has never been swept is always next.
  add column if not exists last_swept_at timestamptz;

create index if not exists creator_industries_sweep_idx
  on creator.creator_industries (user_id, last_swept_at nulls first)
  where deleted_at is null;
