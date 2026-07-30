-- Allow CareerOS brain chat sessions (channel = careeros).

alter table public.chat_sessions drop constraint if exists chat_sessions_channel_check;

alter table public.chat_sessions
  add constraint chat_sessions_channel_check
  check (channel in ('sidekick', 'context', 'office-hours', 'careeros'));

comment on column public.chat_sessions.channel is
  'sidekick = founder widget; context = context page; office-hours; careeros = Career OS brain chat';
