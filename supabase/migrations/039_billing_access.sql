-- ============================================================
-- Billing access / hosted checkout support
-- Track payment access at the account level and keep a small
-- audit trail of webhook events for debugging.
-- ============================================================

CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'lemonsqueezy',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'paid',
      'active',
      'on_trial',
      'past_due',
      'cancelled',
      'expired',
      'unpaid',
      'paused',
      'refunded'
    )),
  customer_email TEXT,
  customer_name TEXT,
  provider_customer_id TEXT,
  provider_order_id TEXT,
  provider_subscription_id TEXT,
  provider_variant_id TEXT,
  provider_checkout_id TEXT,
  last_checkout_url TEXT,
  promo_code TEXT,
  last_event_name TEXT,
  last_event_at TIMESTAMPTZ,
  access_granted_at TIMESTAMPTZ,
  access_expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL DEFAULT 'lemonsqueezy',
  event_name TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing account"
  ON billing_accounts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own billing webhook events"
  ON billing_webhook_events FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_user_id
  ON billing_accounts(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_accounts_provider_subscription_id
  ON billing_accounts(provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_accounts_provider_order_id
  ON billing_accounts(provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_user_id
  ON billing_webhook_events(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_provider_resource
  ON billing_webhook_events(provider, resource_type, resource_id);

CREATE TRIGGER set_billing_accounts_updated_at
  BEFORE UPDATE ON billing_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
