-- Todo research: stores deep-research briefs triggered when a user adds a custom todo item

create table if not exists todo_research (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id text not null,
  todo_text text not null,
  status text not null default 'pending', -- pending | running | done | error
  summary text,
  key_findings jsonb not null default '[]',
  action_items jsonb not null default '[]',
  sources jsonb not null default '[]',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_todo_research_user_todo
  on todo_research(user_id, todo_id);
create index if not exists idx_todo_research_user_created
  on todo_research(user_id, created_at desc);

alter table todo_research enable row level security;

drop policy if exists "todo_research_owner_all" on todo_research;
create policy "todo_research_owner_all"
  on todo_research for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
