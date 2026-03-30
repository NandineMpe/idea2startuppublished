-- chat_sessions.channel: add column if missing (012 never ran), then allow office-hours.
-- Safe to re-run.

alter table chat_sessions
  add column if not exists channel text not null default 'sidekick';

alter table chat_sessions drop constraint if exists chat_sessions_channel_check;

alter table chat_sessions
  add constraint chat_sessions_channel_check
  check (channel in ('sidekick', 'context', 'office-hours'));

create index if not exists idx_chat_sessions_user_channel
  on chat_sessions (user_id, channel);

comment on column chat_sessions.channel is 'sidekick = Juno widget; context = context chat; office-hours = Office Hours';
