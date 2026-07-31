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

alter table creator.creator_signals
  drop constraint if exists creator_signals_lane_check;

alter table creator.creator_signals
  add constraint creator_signals_lane_check
  check (lane in (
    'news', 'papers', 'releases', 'books', 'discussion',
    'patents', 'filings', 'courts', 'funding', 'regulation', 'standards', 'code', 'models',
    'jobs', 'scholarship', 'inspections', 'consultations', 'supervisors',
    'procurement', 'conferences', 'retractions', 'syscards'
  ));
