-- Stories need a way off the screen once they have been dealt with.
--
-- 'archived' keeps the thesis so synthesis still sees it in the do-not-repeat
-- list, which is what stops the same take resurfacing next week. Deletion is a
-- separate action for genuine mistakes, where suppressing the topic in future
-- would be the wrong outcome.

alter table creator.creator_stories
  drop constraint if exists creator_stories_state_check;

alter table creator.creator_stories
  add constraint creator_stories_state_check
  check (state in ('watchlist', 'proposed', 'approved', 'killed', 'published', 'archived'));
