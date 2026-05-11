-- CareerOS Module 1.4 — store raw O*NET occupation skill graph (hierarchical JSON from
-- GET …/mnm/careers/{soc}/skills). Populated by Inngest `careeros/profile.onet-map` (service_role only).

create table if not exists careeros.user_onet_skill_graphs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onet_soc_code text not null,
  graph_payload jsonb not null,
  endpoint_used text,
  fetch_http_status integer not null,
  updated_at timestamptz not null default now()
);

create index if not exists careeros_user_onet_skill_graphs_soc_idx
  on careeros.user_onet_skill_graphs(onet_soc_code);

alter table careeros.user_onet_skill_graphs enable row level security;

grant select on careeros.user_onet_skill_graphs to authenticated;

drop policy if exists "users select own careeros user_onet_skill_graphs" on careeros.user_onet_skill_graphs;
create policy "users select own careeros user_onet_skill_graphs"
  on careeros.user_onet_skill_graphs for select
  using (auth.uid() = user_id);

drop trigger if exists careeros_user_onet_skill_graphs_set_updated_at on careeros.user_onet_skill_graphs;
create trigger careeros_user_onet_skill_graphs_set_updated_at
before update on careeros.user_onet_skill_graphs
for each row execute function careeros.set_updated_at();
