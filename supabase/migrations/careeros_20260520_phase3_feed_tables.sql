create table if not exists careeros.feed_source_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  source_item_id text not null,
  title text not null,
  body text,
  url text not null,
  published_at timestamptz not null,
  authors text[],
  raw_payload jsonb not null default '{}'::jsonb,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, source_item_id)
);

create index if not exists idx_feed_source_items_published
  on careeros.feed_source_items (published_at desc);
create index if not exists idx_feed_source_items_source
  on careeros.feed_source_items (source_key, published_at desc);

create table if not exists careeros.feed_items_enriched (
  id uuid primary key default gen_random_uuid(),
  source_item_id uuid not null references careeros.feed_source_items(id) on delete cascade,
  enriched_summary text not null,
  entity_type text not null,
  entities jsonb not null default '{}'::jsonb,
  affected_functions text[] not null default '{}',
  affected_skills text[] not null default '{}',
  affected_seniority_levels text[] not null default '{}',
  significance_score numeric(3,2),
  enrichment_embedding vector(1536),
  model_version text not null,
  prompt_version text not null,
  schema_version int not null,
  enrichment_completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_item_id)
);

create index if not exists idx_feed_enriched_significance
  on careeros.feed_items_enriched (significance_score desc, enrichment_completed_at desc);
create index if not exists idx_feed_enriched_embedding
  on careeros.feed_items_enriched using hnsw (enrichment_embedding vector_cosine_ops);

alter table careeros.user_ai_feed_items
  add column if not exists enriched_item_id uuid references careeros.feed_items_enriched(id),
  add column if not exists relevance_score numeric(3,2),
  add column if not exists personalised_note text;

grant select on careeros.feed_source_items to authenticated;
grant select on careeros.feed_items_enriched to authenticated;
grant all on careeros.feed_source_items to service_role;
grant all on careeros.feed_items_enriched to service_role;

drop trigger if exists careeros_feed_source_items_set_updated_at on careeros.feed_source_items;
create trigger careeros_feed_source_items_set_updated_at
before update on careeros.feed_source_items
for each row execute function careeros.set_updated_at();

drop trigger if exists careeros_feed_items_enriched_set_updated_at on careeros.feed_items_enriched;
create trigger careeros_feed_items_enriched_set_updated_at
before update on careeros.feed_items_enriched
for each row execute function careeros.set_updated_at();
