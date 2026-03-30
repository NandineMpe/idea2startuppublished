-- CEO Reviews: daily strategic analysis produced by the CBS CEO Review agent
create table if not exists ceo_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  review_date date not null,
  review_data jsonb not null,
  created_at timestamptz default now()
);

create index if not exists ceo_reviews_user_date_idx on ceo_reviews(user_id, review_date desc);

-- Prevent duplicate reviews for the same user on the same day
create unique index if not exists ceo_reviews_user_date_unique on ceo_reviews(user_id, review_date);

alter table ceo_reviews enable row level security;

create policy "users own their ceo reviews"
  on ceo_reviews for all
  using (auth.uid() = user_id);
