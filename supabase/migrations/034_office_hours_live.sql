-- =============================================================================
-- Office Hours — chat_sessions only (must succeed on its own)
-- apply-all-supabase-migrations.cjs runs each file in ONE transaction; if this
-- file mixed in design_docs and that part failed, the channel fix rolled back.
-- Paste in Supabase → SQL, or: npm run db:migrate with DATABASE_URL set.
-- Safe to run multiple times.
-- =============================================================================

-- Drop any CHECK on chat_sessions that mentions channel IN (...) (handles renames)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'chat_sessions'
      AND c.contype = 'c'
      AND (
        pg_get_constraintdef(c.oid) ~* 'channel.*IN'
        OR (
          pg_get_constraintdef(c.oid) ILIKE '%channel%'
          AND pg_get_constraintdef(c.oid) ILIKE '%sidekick%'
        )
      )
  LOOP
    EXECUTE format('ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

alter table chat_sessions
  add column if not exists channel text not null default 'sidekick';

-- 012 always used this name; explicit drop in case the DO block did not match
alter table chat_sessions drop constraint if exists chat_sessions_channel_check;

alter table chat_sessions
  add constraint chat_sessions_channel_check
  check (channel in ('sidekick', 'context', 'office-hours'));

comment on column chat_sessions.channel is
  'sidekick = Juno widget; context = context chat; office-hours = Office Hours';

-- mode: startup | builder | null for non–office-hours rows
alter table chat_sessions add column if not exists mode text;

alter table chat_sessions drop constraint if exists chat_sessions_mode_check;

alter table chat_sessions
  add constraint chat_sessions_mode_check
  check (mode is null or mode in ('startup', 'builder'));

create index if not exists idx_chat_sessions_user_channel
  on chat_sessions (user_id, channel);
