alter table careeros.feed_items_enriched
  add column if not exists item_primary_function text,
  add column if not exists item_function_confidence numeric(4,3);

alter table careeros.user_ai_feed_items
  add column if not exists serving_policy jsonb not null default '{}'::jsonb;

create index if not exists careeros_feed_items_enriched_item_primary_function_idx
  on careeros.feed_items_enriched(item_primary_function, enrichment_completed_at desc);

create index if not exists careeros_user_ai_feed_items_serving_policy_mode_idx
  on careeros.user_ai_feed_items((serving_policy ->> 'serving_mode'), created_at desc);
