create table if not exists careeros.user_profile_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  extraction_id uuid references careeros.user_document_extractions(id) on delete set null,
  section text not null,
  field_path text,
  current_value jsonb,
  user_correction text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists careeros_user_profile_corrections_user_created_idx
  on careeros.user_profile_corrections(user_id, created_at desc);

alter table careeros.user_profile_corrections enable row level security;

drop policy if exists user_profile_corrections_select on careeros.user_profile_corrections;
create policy user_profile_corrections_select
  on careeros.user_profile_corrections
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists user_profile_corrections_insert on careeros.user_profile_corrections;
create policy user_profile_corrections_insert
  on careeros.user_profile_corrections
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists user_profile_corrections_update on careeros.user_profile_corrections;
create policy user_profile_corrections_update
  on careeros.user_profile_corrections
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists careeros_user_profile_corrections_set_updated_at on careeros.user_profile_corrections;
create trigger careeros_user_profile_corrections_set_updated_at
before update on careeros.user_profile_corrections
for each row execute function careeros.set_updated_at();
