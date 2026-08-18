-- Brand conversations, so a reply can be followed up.
--
-- The brief reply drafted a good email and then threw it away. It lived in React
-- state and nowhere else, so the moment the tab closed there was no record that
-- a brand had ever written, what was quoted, or when. That is survivable for the
-- reply itself, which gets copied out immediately, and fatal for everything
-- after it: a follow-up is by definition sent days later, against a conversation
-- the system would have had no memory of.
--
-- Most deals are lost to silence rather than to a no. The follow-up is the
-- cheapest revenue in the pipeline and it is the one thing a person reliably
-- does not do, because doing it means remembering who has not replied.
create table if not exists creator.creator_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  brand text,
  -- The inbound email verbatim. Every follow-up is grounded in what they
  -- actually asked for, and a paraphrase drifts by the third message.
  inbound text not null,

  what_they_want text,
  deliverables text[] not null default '{}',
  quoted_total numeric(12,2),
  currency text,

  -- The outbound sequence in order: the reply, then each follow-up.
  --
  -- jsonb rather than a child table because a conversation holds three or four
  -- messages and never grows unbounded, and the read is always the whole
  -- sequence at once. Each element is
  --   { seq, kind, body, drafted_at, sent_at }
  -- with kind in (reply, follow_up, breakup).
  messages jsonb not null default '[]'::jsonb,

  -- open       drafted or sent, no answer yet
  -- replied    they came back; follow-ups stop
  -- won        booked
  -- lost       explicit no, or she called it
  state text not null default 'open' check (state in ('open', 'replied', 'won', 'lost')),

  -- Set when she confirms the email went out. Null means drafted but unsent, and
  -- the difference matters: chasing an email that was never sent is the worst
  -- possible message to receive.
  sent_at timestamptz,
  -- Moves on every send, so "days since contact" measures silence rather than age.
  last_contact_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists creator_conversations_user_state_idx
  on creator.creator_conversations (user_id, state, last_contact_at desc nulls last)
  where deleted_at is null;

alter table creator.creator_conversations enable row level security;
grant select, insert, update on creator.creator_conversations to authenticated;
grant all on creator.creator_conversations to service_role;

drop policy if exists "users read own creator conversations" on creator.creator_conversations;
create policy "users read own creator conversations"
  on creator.creator_conversations for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own creator conversations" on creator.creator_conversations;
create policy "users insert own creator conversations"
  on creator.creator_conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own creator conversations" on creator.creator_conversations;
create policy "users update own creator conversations"
  on creator.creator_conversations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
