-- Positioning: the brand-facing read of the canon.
--
-- The canon describes what the creator makes. This describes why a marketer
-- should care, in the terms they screen on — audience specificity, engagement
-- against category norms, and brand safety — rather than a personal "about me".
--
-- Held on the canon row because it is derived from the same corpus and should
-- be re-derivable alongside it, but generated separately: writing media-kit
-- copy is a different job from clustering pillars and formats.

alter table creator.creator_canon
  add column if not exists positioning jsonb,
  add column if not exists positioning_derived_at timestamptz;
