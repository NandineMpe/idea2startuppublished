-- Idempotent hotfix: allow chat_sessions.channel = 'office-hours'.
-- Needed if 031 was not applied (e.g. design_docs step failed) or DB is behind.
alter table chat_sessions drop constraint if exists chat_sessions_channel_check;
alter table chat_sessions
  add constraint chat_sessions_channel_check
  check (channel in ('sidekick', 'context', 'office-hours'));
