-- The second tier of primary sources.
--
--   jobs           a firm creating "Head of AI Assurance" has already decided,
--                  budgeted and got sign-off, months before it says anything
--   scholarship    OpenAlex, which indexes the accounting, audit, law and finance
--                  journals arXiv does not carry at all
--   inspections    what the regulator found when it actually looked
--   consultations  an open consultation is a door with a deadline, and responses
--                  are published under the respondent's name
--   supervisors    central banks and financial stability boards, early and careful
--   procurement    who is buying, with the specification and often the price
--   conferences    accepted papers the trade press will quote in about a year
--   retractions    the retraction notice itself rather than a report of one
--   syscards       the lab's technical appendix, a different genre from the launch post

-- Drop only. Phase 19 installs the final lane list.
--
-- This file used to ADD a constraint naming the lanes that existed when it was
-- written, which made replaying the sequence fail the moment a later migration
-- widened it: rows using a phase 19 lane are perfectly valid and violate the
-- phase 12 check. A migration that narrows a constraint is a time bomb in a
-- runner that reapplies everything, and this is the second one.
alter table creator.creator_signals
  drop constraint if exists creator_signals_lane_check;
