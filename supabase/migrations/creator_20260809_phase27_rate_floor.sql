-- The floor is a fact, not a percentile.
--
-- Worth priced every deal off the view distribution alone: p25 x cpm_low for the
-- bottom of the band, p75 x cpm_high for the top. With a proven paid rate of USD
-- 950 that produced a band opening at USD 452, which is not a negotiating
-- position, it is a discount coupon. A rate card whose lowest number sits below
-- what a brand has already paid gives the next brand a reason to open there.
--
-- rate_floor is the highest fee actually received for a single sponsored video.
-- It is the one input to Worth that is neither derived nor a market estimate: it
-- is a receipt. The band is clamped to it, so the quoted low can never fall
-- under a number that has already cleared.
alter table creator.creator_settings
  add column if not exists rate_floor numeric(10,2) check (rate_floor is null or rate_floor > 0);

comment on column creator.creator_settings.rate_floor is
  'Highest fee actually paid for one sponsored video. Clamps the low end of every rate band.';

-- What the brand does with the video after it is delivered.
--
-- The old model priced a single organic post and stopped there, so paid
-- amplification, category exclusivity and perpetual buyout were all being handed
-- over inside the same fee. Those are the line items the market prices as a
-- percentage of base, and the percentages are the negotiation. Stored so the
-- creator can move them without a deploy, defaulted null so the code catalogue
-- applies until she does.
alter table creator.creator_settings
  add column if not exists rate_overrides jsonb not null default '{}'::jsonb;

comment on column creator.creator_settings.rate_overrides is
  'Per-line-item percentage overrides keyed by line item key, e.g. {"usage_perpetual": 2.5}.';
