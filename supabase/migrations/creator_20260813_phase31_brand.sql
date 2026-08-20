-- Brand maxing: appearance as a production schedule, not a wish list.
--
-- The request was "what should I be doing to look my best on camera, and where
-- are the deals". The list of treatments is the easy half and the half that is
-- already on every blog. The half nobody has is the timing.
--
-- Every appearance treatment has a lead time, exactly like the registers on the
-- In industry screen. A superficial peel flakes on days two to five, so booking
-- one three days before a shoot costs you the shoot. Brow lamination looks
-- severe and glossy for the first day or two and settles by day three. Manual
-- lymphatic drainage is the opposite of maintenance: the de-puffing peaks
-- within a day or two and is gone by the end of the week, so it is a
-- day-before treatment and doing it on a quiet Tuesday is money burned.
--
-- So this stores a protocol register with lead times and a next shoot date, and
-- the screen works backwards from the shoot. That is the whole product. The
-- catalogue is seeded from code on first use rather than here, because a
-- migration reapplies on every deploy and would overwrite her edited cadences
-- and the prices she actually paid.
--
-- Prices are hers, not ours. The seeds carry an indicative range so a new row
-- is not blank, and the field that matters is what she was actually quoted and
-- actually paid, because that is the number no deals site can give her.

create table if not exists creator.creator_brand_protocols (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  protocol_key text not null,
  label text not null,
  -- brow, lash, skin, body, hair, teeth, hands, wardrobe
  category text not null default 'skin',

  -- Whether she actually does this. Everything is seeded as inactive: a
  -- register that starts full of treatments she has never had is a shopping
  -- list pretending to be a record.
  active boolean not null default false,

  -- The timing that makes this screen worth having.
  --
  -- lead_days_before_camera: minimum days between the treatment and filming.
  --   Peels flake, needling stays red, wrinkle relaxers have not settled.
  -- peak_days_after: when it looks its best, which is what you actually aim at.
  -- repeat_weeks: how often it needs redoing, drives the "due" calculation.
  lead_days_before_camera integer not null default 0
    check (lead_days_before_camera >= 0 and lead_days_before_camera <= 90),
  peak_days_after integer not null default 0
    check (peak_days_after >= 0 and peak_days_after <= 90),
  repeat_weeks integer
    check (repeat_weeks is null or (repeat_weeks > 0 and repeat_weeks <= 104)),

  -- Her actual money, in her settings currency.
  last_paid numeric(10,2) check (last_paid is null or last_paid >= 0),
  best_quote numeric(10,2) check (best_quote is null or best_quote >= 0),
  provider text,

  last_done_at date,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  unique (user_id, protocol_key)
);

create index if not exists creator_brand_protocols_user_idx
  on creator.creator_brand_protocols (user_id, active, last_done_at)
  where deleted_at is null;

-- Deals she has found, with the only field that matters: when it dies.
--
-- Not scraped. There is no dependable open feed of Dublin salon offers, and a
-- fabricated one would send her to a clinic that never ran the offer, which is
-- worse for her than an empty screen. This is a ledger she fills, and the
-- product's job is to stop a voucher expiring unused, which is the actual way
-- money is lost on these.
create table if not exists creator.creator_brand_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  title text not null,
  provider text,
  url text,
  source text,
  price numeric(10,2) check (price is null or price >= 0),
  normal_price numeric(10,2) check (normal_price is null or normal_price >= 0),
  -- Which protocol it buys, so a deal can be judged against what she pays now.
  protocol_key text,

  expires_on date,
  -- booked once redeemed, so an unbooked voucher can be chased before it dies.
  state text not null default 'saved'
    check (state in ('saved', 'booked', 'used', 'expired', 'passed')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists creator_brand_deals_user_idx
  on creator.creator_brand_deals (user_id, expires_on)
  where deleted_at is null;

-- The date everything is scheduled backwards from.
alter table creator.creator_settings
  add column if not exists next_shoot_at date;

-- How she presents, so the guidance is about her face and not a generic one.
--
-- Stored rather than assumed. The same treatment is asked for differently
-- depending on the presentation you are going for: a laminated brow for a
-- masculine presentation is brushed up and low hold with no arch added, and the
-- default a salon reaches for is the opposite of that. Getting this wrong
-- produces advice that is worse than none.
alter table creator.creator_settings
  add column if not exists presentation text
    check (presentation is null or presentation in ('masculine', 'feminine', 'androgynous'));

alter table creator.creator_brand_protocols enable row level security;
alter table creator.creator_brand_deals enable row level security;

grant select, insert, update on creator.creator_brand_protocols to authenticated;
grant select, insert, update on creator.creator_brand_deals to authenticated;
grant all on creator.creator_brand_protocols to service_role;
grant all on creator.creator_brand_deals to service_role;

drop policy if exists "users read own brand protocols" on creator.creator_brand_protocols;
create policy "users read own brand protocols"
  on creator.creator_brand_protocols for select using (auth.uid() = user_id);

drop policy if exists "users insert own brand protocols" on creator.creator_brand_protocols;
create policy "users insert own brand protocols"
  on creator.creator_brand_protocols for insert with check (auth.uid() = user_id);

drop policy if exists "users update own brand protocols" on creator.creator_brand_protocols;
create policy "users update own brand protocols"
  on creator.creator_brand_protocols for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read own brand deals" on creator.creator_brand_deals;
create policy "users read own brand deals"
  on creator.creator_brand_deals for select using (auth.uid() = user_id);

drop policy if exists "users insert own brand deals" on creator.creator_brand_deals;
create policy "users insert own brand deals"
  on creator.creator_brand_deals for insert with check (auth.uid() = user_id);

drop policy if exists "users update own brand deals" on creator.creator_brand_deals;
create policy "users update own brand deals"
  on creator.creator_brand_deals for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
