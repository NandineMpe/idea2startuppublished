-- First-signal lanes.
--
-- The existing lanes read institutions, which can only publish about something
-- after it exists and someone has noticed. These sit upstream of that:
--
--   changelogs     capability, the day it became available
--   ventures       capital committed to a specific future, before the product
--   grants         funded research at award, ~2y before the paper
--   solicitations  the state specifying technology that does not exist, 2-4y out
--
-- The bar here is different from the primary lanes. There the value is that the
-- document is authoritative; here it is that almost nobody has read it yet.
alter table creator.creator_signals
  drop constraint if exists creator_signals_lane_check;

alter table creator.creator_signals
  add constraint creator_signals_lane_check
  check (lane in (
    'news', 'papers', 'releases', 'books', 'discussion',
    'patents', 'filings', 'courts', 'funding', 'regulation', 'standards', 'code', 'models',
    'jobs', 'scholarship', 'inspections', 'consultations', 'supervisors',
    'procurement', 'conferences', 'retractions', 'syscards',
    'changelogs', 'ventures', 'grants', 'solicitations'
  ));
