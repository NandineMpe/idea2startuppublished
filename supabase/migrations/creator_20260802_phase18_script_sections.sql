-- The house script structure, stored as its parts.
--
-- Four sections, in this order:
--
--   point     the conclusion, stated flat and first. Not a tease, not a
--             question. The viewer should be able to leave after four seconds
--             having got the answer, and stay because they want the reasoning.
--   trigger   why this is on screen today. A ruling, a filing, a consultation
--             closing. Without it the piece is an essay rather than a story.
--   analysis  the unpack. Facts and evidence, which for this desk means the
--             documents the story already carries.
--   loop      the close that lands back on the point, phrased so a replay runs
--             continuously into the opening line.
--
-- Kept as parts rather than one blob because the card shows the shape, the
-- visual planner assigns shots per section, and the loop can only be checked
-- against the opening if the opening is addressable. `body` still holds the
-- assembled talk track, so nothing downstream that reads a script breaks.

alter table creator.creator_work
  add column if not exists script_sections jsonb;
