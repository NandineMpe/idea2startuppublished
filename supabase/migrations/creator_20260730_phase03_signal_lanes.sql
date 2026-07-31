-- The Researcher reads across registers, not just the news cycle, and sweeps
-- both the creator's proven ground and the adjacent topics they have not worked.
--
-- `lane`   — which register a signal came from (news, papers, releases, books,
--            discussion). Lets synthesis prefer cross-lane connections, which
--            are the ones a reader could not have assembled themselves.
-- `stance` — 'core' for topics the creator already owns, 'adjacent' for the
--            stretch surface. Separates "consolidate" stories from "expand" ones.

alter table creator.creator_signals
  add column if not exists lane text not null default 'news'
    check (lane in ('news', 'papers', 'releases', 'books', 'discussion')),
  add column if not exists stance text not null default 'core'
    check (stance in ('core', 'adjacent'));

create index if not exists creator_signals_lane_stance_idx
  on creator.creator_signals (user_id, lane, stance, published_at desc);

-- Stories record whether they consolidate the creator's position or move it.
alter table creator.creator_stories
  add column if not exists move text not null default 'consolidate'
    check (move in ('consolidate', 'expand'));
