-- What the creator actually thought, and why.
--
-- The system learned nothing from a kill. A story was proposed, the creator
-- binned it, and the only trace was a state change indistinguishable from any
-- other. The next morning's run had no idea it had just been told something.
-- Every day this is not recorded is a day of labelled taste thrown away, which
-- is why it is built before anything more interesting.
--
-- Six reasons, chosen so one tap commits. A free-text box would be more
-- expressive and would be filled in for a week and then never again.

create table if not exists creator.creator_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Deliberately NOT cascade-deleted. A decision has to outlive the thing it
  -- was about: the whole point of the table is that emptying the recycle bin
  -- must not also erase the taste signal. The subject is denormalised below for
  -- the same reason, so an exemplar still reads sensibly after the row is gone.
  work_id  uuid references creator.creator_work(id) on delete set null,
  story_id uuid references creator.creator_stories(id) on delete set null,

  decision text not null check (decision in ('approve', 'kill', 'archive')),

  -- boring        no stakes, nothing at risk
  -- too_heavy     needs research there is no time for
  -- off_brand     institutional gaze, wrong stance
  -- not_me        true and useful, but not this creator's voice
  -- done_before   repeats an existing post
  -- wrong_format  good material, wrong output type
  -- weak_receipts cannot be stood up
  reason text check (reason in (
    'boring', 'too_heavy', 'off_brand', 'not_me', 'done_before', 'wrong_format', 'weak_receipts'
  )),
  note text,

  -- Denormalised at write time so the taste profile can quote what was killed
  -- without joining to a row that may since have been deleted.
  subject text,
  move text,
  output_format text,

  decided_at timestamptz not null default now()
);

-- A kill without a reason is the thing this table exists to prevent, and an
-- approve carrying one is a taxonomy error. Enforced here rather than in the
-- server action because the action is not the only writer.
alter table creator.creator_decisions
  drop constraint if exists creator_decisions_reason_required_on_kill;
alter table creator.creator_decisions
  add constraint creator_decisions_reason_required_on_kill
  check (
    (decision = 'kill' and reason is not null)
    or (decision <> 'kill' and reason is null)
  );

create index if not exists creator_decisions_user_decided_idx
  on creator.creator_decisions (user_id, decided_at desc);
create index if not exists creator_decisions_work_idx
  on creator.creator_decisions (work_id);
create index if not exists creator_decisions_reason_idx
  on creator.creator_decisions (user_id, reason) where reason is not null;

alter table creator.creator_decisions enable row level security;
grant select, insert on creator.creator_decisions to authenticated;
grant all on creator.creator_decisions to service_role;

-- Append-only by convention: a changed mind is a new row, so the history stays
-- intact. No update or delete grant, which makes the convention structural.
drop policy if exists "users read own creator decisions" on creator.creator_decisions;
create policy "users read own creator decisions"
  on creator.creator_decisions for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own creator decisions" on creator.creator_decisions;
create policy "users insert own creator decisions"
  on creator.creator_decisions for insert
  with check (auth.uid() = user_id);

-- The rolled-up read of the above, rewritten weekly.
--
-- Raw decision rows are never injected into a prompt. The list grows without
-- bound, it costs a fortune to resend, and a model given a hundred kills
-- over-fits to whichever ones happen to be most recent. A profile is a fixed
-- size no matter how long the creator has been using this.
create table if not exists creator.creator_taste (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz,
  window_end timestamptz,
  approve_count integer not null default 0,
  kill_count integer not null default 0,
  -- {reason: count}
  kill_counts jsonb not null default '{}'::jsonb,
  -- {reason: [{subject, note}]} — at most three per reason, so the block a
  -- prompt sees stays bounded whatever the volume behind it.
  exemplars jsonb not null default '{}'::jsonb,
  rebuilt_at timestamptz
);

alter table creator.creator_taste enable row level security;
grant select on creator.creator_taste to authenticated;
grant all on creator.creator_taste to service_role;

drop policy if exists "users read own creator taste" on creator.creator_taste;
create policy "users read own creator taste"
  on creator.creator_taste for select
  using (auth.uid() = user_id);
