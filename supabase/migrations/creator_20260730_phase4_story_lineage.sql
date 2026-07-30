-- Lineage: what a story is the latest instance of.
--
-- A dossier answers "what happened". This answers "what is this a continuation
-- of" — the prior attempts, the research underneath, the question that keeps
-- recurring, and the honest delta between this time and last time.
--
-- Derived on demand rather than for every story: it costs a separate research
-- pass, and only stories the creator is actually going to make need it.

alter table creator.creator_stories
  add column if not exists lineage jsonb,
  add column if not exists lineage_state text not null default 'none'
    check (lineage_state in ('none', 'running', 'done', 'failed')),
  add column if not exists lineage_derived_at timestamptz;
