-- Example posting (title + URL) per frontier cluster snapshot for credibility links.

alter table careeros.market_frontier_role_weekly
  add column if not exists example_posting_title text,
  add column if not exists example_posting_url text;

comment on column careeros.market_frontier_role_weekly.snapshot_week is
  'Period anchor date: calendar month start (UTC) for monthly snapshots; legacy rows may use week-start dates.';
