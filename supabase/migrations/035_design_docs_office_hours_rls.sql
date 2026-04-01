-- design_docs for Office Hours completion (separate migration so a failure here
-- does not roll back 034 chat_sessions channel/mode fixes).

create table if not exists design_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id uuid references chat_sessions(id) on delete set null,
  mode text check (mode in ('startup', 'builder')) not null,
  title text not null,
  doc_data jsonb not null,
  status text default 'draft' check (status in ('draft', 'approved')),
  created_at timestamptz default now()
);

create index if not exists design_docs_user_created_idx
  on design_docs (user_id, created_at desc);

alter table design_docs enable row level security;

drop policy if exists "users own their design docs" on design_docs;
create policy "users own their design docs"
  on design_docs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
