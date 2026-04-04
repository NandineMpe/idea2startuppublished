-- Product virality: personal referral codes and signup attribution (not org invites).

CREATE TABLE IF NOT EXISTS public.user_referral_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_referral_codes_code_lower ON public.user_referral_codes (lower(code));

CREATE TABLE IF NOT EXISTS public.user_referral_attributions (
  referred_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_referral_attributions_referrer
  ON public.user_referral_attributions(referrer_user_id);

ALTER TABLE public.user_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_referral_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own referral code" ON public.user_referral_codes;
CREATE POLICY "Users read own referral code"
  ON public.user_referral_codes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own referral attribution" ON public.user_referral_attributions;
CREATE POLICY "Users read own referral attribution"
  ON public.user_referral_attributions FOR SELECT
  USING (auth.uid() = referred_user_id);

DROP POLICY IF EXISTS "Referrers read their attributions" ON public.user_referral_attributions;
CREATE POLICY "Referrers read their attributions"
  ON public.user_referral_attributions FOR SELECT
  USING (auth.uid() = referrer_user_id);
