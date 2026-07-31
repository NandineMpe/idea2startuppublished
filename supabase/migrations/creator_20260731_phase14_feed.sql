-- The wire.
--
-- The desk collects several hundred documents a day and files seven stories.
-- Everything else has been invisible: of 529 signals gathered so far, 100 were
-- ever cited and 429 have never been in front of the creator at all.
--
-- For a creator whose whole position is being a primary producer rather than a
-- reporter, that is backwards. The unread 429 are patents, dockets, filings,
-- consultations and inspection reports. Being able to scroll them, spot the
-- connection yourself, and say "build me a story on that" is the actual
-- primary-source workflow. Synthesis picking seven is a convenience on top of
-- it, not a replacement for it.
--
-- Two timestamps make the difference between the raw pile and a usable feed:
-- what the Researcher has already looked at, and what it actually used. Without
-- them there is no way to show "considered but not filed", which is the most
-- interesting slice of all — those are the documents a machine read and passed
-- on, where a human might not.

alter table creator.creator_signals
  -- Set when a signal reaches a synthesis prompt. The Researcher saw this.
  add column if not exists considered_at timestamptz,
  -- Set when a story cites it. The Researcher built on this.
  add column if not exists used_at timestamptz;

-- Backfill from the stories that already exist, so the feed is accurate on the
-- first render rather than after the next sweep.
update creator.creator_signals s
set used_at = coalesce(s.used_at, st.created_at),
    considered_at = coalesce(s.considered_at, st.created_at)
from creator.creator_stories st
where s.id = any(st.signal_ids)
  and s.user_id = st.user_id;

-- The feed pages by ingestion order, newest first, per user.
create index if not exists creator_signals_user_feed_idx
  on creator.creator_signals (user_id, ingested_at desc, id);

create index if not exists creator_signals_user_lane_feed_idx
  on creator.creator_signals (user_id, lane, ingested_at desc);
