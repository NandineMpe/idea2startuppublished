-- Primary source lanes.
--
-- The original five were news, papers, releases, books and discussion. Three of
-- those are people writing about something that already happened, which caps
-- the desk at being fast. It cannot be first, and it can never say "here is the
-- document" because it never holds one.
--
-- These eight hold documents rather than coverage, and each is upstream of the
-- headline by a knowable amount:
--
--   code        what engineers adopt, months before vendors describe it
--   models      what actually shipped, measurable rather than asserted
--   funding     research funded now becomes papers in ~2y and products in ~4y
--   patents     R&D intent, published 18 months after filing, still ahead of launch
--   courts      complaints and expert reports, years before the landmark ruling
--   regulation  proposed rules and open comment periods, before anything binds
--   filings     what companies tell investors under legal liability, ahead of PR
--   standards   what "compliant" will mean, before anyone has to comply

-- The runner re-applies every migration on every run, so a migration that
-- NARROWS a check constraint is a trap: once later data uses the wider set,
-- re-running this file fails on rows that are perfectly valid. This one drops
-- the constraint and leaves phase 12 to install the final list, so replaying
-- the whole sequence is safe in any order of one.
alter table creator.creator_signals
  drop constraint if exists creator_signals_lane_check;
