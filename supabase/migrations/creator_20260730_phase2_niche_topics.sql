-- Declared niche topics on settings: the Researcher's stopgap input until the
-- canon is derived from the corpus. Once creator_canon.topics exists for a user,
-- the derived topic graph takes precedence over this list.

alter table creator.creator_settings
  add column if not exists niche_topics text[] not null default '{}';
