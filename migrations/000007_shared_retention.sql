-- ============================================================
-- MIGRATION 000007 — Shared retention tables (Module 6.23)
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- Loyalty, referrals, coupons, subscriptions all live in `shared`
-- because a customer's retention state is the same regardless of
-- which brand they engage with. A Pixie buyer who also uses
-- Faitlyn services has ONE points balance and ONE referral code.
--
-- Tables:
--   loyalty_tiers, loyalty_ledger, customer_loyalty_state
--   referrals, referral_redemptions
--   coupons, coupon_redemptions
--   subscription_plans, subscriptions, subscription_billing_attempts
-- ============================================================

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ LOYALTY                                                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── loyalty_tiers ────────────────────────────────────────
-- Per-brand tier definitions (Bronze / Silver / Gold / Platinum
-- at launch). Multipliers, thresholds, benefits — all editable.
CREATE TABLE shared.loyalty_tiers (
  tier_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  tier_key              TEXT        NOT NULL,                  -- 'bronze','silver','gold','platinum'
  tier_name             TEXT        NOT NULL,                  -- Display name
  min_lifetime_points   INTEGER     NOT NULL DEFAULT 0,
  max_lifetime_points   INTEGER,                                -- NULL = top tier
  earning_multiplier    NUMERIC(4,2) NOT NULL DEFAULT 1.00,    -- 1.00 / 1.50 / 2.00 / 3.00
  -- Benefits JSONB: {"free_shipping":true, "early_access":true, ...}
  benefits              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  colour                TEXT        DEFAULT '#64748B',
  display_order         SMALLINT    NOT NULL DEFAULT 0,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  UNIQUE (business, tier_key)
);
CREATE TRIGGER trg_loyalty_tiers_updated_at
  BEFORE UPDATE ON shared.loyalty_tiers
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_loyalty_tiers_business ON shared.loyalty_tiers (business, display_order)
  WHERE is_active = true;

-- ── loyalty_ledger ───────────────────────────────────────
-- APPEND-ONLY ledger. Current balance = SUM(points) per contact, business.
-- Every earn and every redeem is its own row.
CREATE TABLE shared.loyalty_ledger (
  ledger_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID        NOT NULL REFERENCES shared.contacts (contact_id) ON DELETE CASCADE,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  transaction_type      TEXT        NOT NULL
                        CHECK (transaction_type IN ('earned_purchase','earned_review','earned_referral',
                                                    'earned_milestone','earned_social_share','earned_bonus',
                                                    'redeemed','expired','adjustment','reversal')),
  points                INTEGER     NOT NULL,                  -- positive = earned, negative = redeemed/expired/adjustment-out
  -- The earning multiplier applied at the time of the earn (audit trail)
  multiplier_used       NUMERIC(4,2),
  -- What triggered this entry (always a record in some brand schema)
  reference_type        TEXT,                                  -- 'sales_order','invoice','product_review','referral_redemption'
  reference_id          UUID,
  notes                 TEXT,
  expires_at            TIMESTAMPTZ,                            -- only for 'earned_*' rows
  -- Reversal of a prior ledger entry (e.g. order cancelled)
  reverses_ledger_id    UUID        REFERENCES shared.loyalty_ledger (ledger_id) ON DELETE SET NULL,
  created_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loyalty_ledger_contact  ON shared.loyalty_ledger (contact_id, business, created_at DESC);
CREATE INDEX idx_loyalty_ledger_type     ON shared.loyalty_ledger (transaction_type, created_at DESC);
CREATE INDEX idx_loyalty_ledger_expires  ON shared.loyalty_ledger (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_loyalty_ledger_ref      ON shared.loyalty_ledger (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ── customer_loyalty_state ───────────────────────────────
-- Materialised summary for fast lookup. Maintained by a trigger on
-- loyalty_ledger (added in 000013) and by a nightly tier-recompute job.
-- The ledger remains the source of truth; this is purely for display.
CREATE TABLE shared.customer_loyalty_state (
  state_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID        NOT NULL REFERENCES shared.contacts (contact_id) ON DELETE CASCADE,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  current_balance       INTEGER     NOT NULL DEFAULT 0,
  lifetime_earned       INTEGER     NOT NULL DEFAULT 0,        -- never decreases; drives tier
  lifetime_redeemed     INTEGER     NOT NULL DEFAULT 0,
  current_tier_id       UUID        REFERENCES shared.loyalty_tiers (tier_id) ON DELETE SET NULL,
  tier_entered_at       TIMESTAMPTZ,
  last_activity_at      TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, business)
);
CREATE TRIGGER trg_loyalty_state_updated_at
  BEFORE UPDATE ON shared.customer_loyalty_state
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_loyalty_state_business_tier ON shared.customer_loyalty_state (business, current_tier_id);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ REFERRALS                                                          ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── referrals ────────────────────────────────────────────
-- One per customer-brand combination. The referral_code is the
-- public token (e.g. FAITH2026) that gets shared.
CREATE TABLE shared.referrals (
  referral_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID        NOT NULL REFERENCES shared.contacts (contact_id) ON DELETE CASCADE,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  referral_code         TEXT        NOT NULL UNIQUE,           -- e.g. 'FAITH2026'
  -- Rolling counters for the tier-reward ladder (5 / 10 → bigger payout)
  successful_count      INTEGER     NOT NULL DEFAULT 0,
  total_rewards_value   NUMERIC(12,2) NOT NULL DEFAULT 0,      -- in NGN
  -- Reward rules at the time of generation (snapshot so future rule
  -- changes don't retroactively alter expectations).
  reward_rules          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, business)
);
CREATE TRIGGER trg_referrals_updated_at
  BEFORE UPDATE ON shared.referrals
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_referrals_code ON shared.referrals (referral_code);

-- ── referral_redemptions ─────────────────────────────────
-- One row per friend who used the code. Tracks anti-fraud signals.
CREATE TABLE shared.referral_redemptions (
  redemption_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id           UUID        NOT NULL REFERENCES shared.referrals (referral_id) ON DELETE RESTRICT,
  referred_contact_id   UUID        NOT NULL REFERENCES shared.contacts (contact_id),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  -- Order that triggered the referral reward (in the brand schema)
  triggering_order_id   UUID,
  triggering_order_value NUMERIC(14,2),
  -- Anti-fraud signals captured at redemption
  redeemed_ip           INET,
  redeemed_device_fp    TEXT,
  fraud_check_result    TEXT        NOT NULL DEFAULT 'passed'
                        CHECK (fraud_check_result IN ('passed','flagged_self_referral','flagged_device_match',
                                                      'flagged_payment_match','rejected','manual_review')),
  fraud_check_notes     TEXT,
  -- Rewards distributed
  referrer_reward_points INTEGER    NOT NULL DEFAULT 0,
  referrer_reward_credit NUMERIC(12,2) NOT NULL DEFAULT 0,
  referred_discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  status                TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','rewarded','reversed','rejected')),
  rewarded_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A referred customer can only redeem once per brand
  UNIQUE (referral_id, referred_contact_id)
);
CREATE INDEX idx_referral_redemptions_referrer ON shared.referral_redemptions (referral_id, status);
CREATE INDEX idx_referral_redemptions_referred ON shared.referral_redemptions (referred_contact_id);
CREATE INDEX idx_referral_redemptions_fraud    ON shared.referral_redemptions (fraud_check_result)
  WHERE fraud_check_result <> 'passed';

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ COUPONS                                                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── coupons ──────────────────────────────────────────────
CREATE TABLE shared.coupons (
  coupon_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  coupon_code           TEXT        NOT NULL,                   -- 'WELCOME10','BLACKFRIDAY'
  display_name          TEXT        NOT NULL,
  description           TEXT,
  discount_type         TEXT        NOT NULL
                        CHECK (discount_type IN ('percentage','fixed_amount','free_shipping','buy_x_get_y')),
  discount_value        NUMERIC(14,4) NOT NULL,                 -- 0.10 = 10%, 5000 = ₦5,000, or {x,y} embedded in metadata
  currency              TEXT        REFERENCES shared.currencies (currency_code), -- only for fixed_amount
  -- Conditions
  min_order_value       NUMERIC(14,2),
  max_discount_value    NUMERIC(14,2),                          -- cap for percentage discounts
  applies_to_products   UUID[],                                 -- empty = all products
  applies_to_categories UUID[],
  customer_segment_id   UUID        REFERENCES shared.contact_segments (segment_id) ON DELETE SET NULL,
  first_time_only       BOOLEAN     NOT NULL DEFAULT false,
  -- Validity
  valid_from            TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to              TIMESTAMPTZ,
  -- Usage
  total_usage_limit     INTEGER,                                -- NULL = unlimited
  per_customer_limit    INTEGER     NOT NULL DEFAULT 1,
  total_redeemed        INTEGER     NOT NULL DEFAULT 0,
  total_discount_given  NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Auto-generated codes for campaigns / influencers (single-use)
  is_single_use         BOOLEAN     NOT NULL DEFAULT false,
  generation_batch_id   UUID,                                   -- groups codes from one generation event
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business, coupon_code)
);
CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON shared.coupons
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
-- Note: the validity window is evaluated in the query, not the index.
-- Index predicate must be immutable (no now()).
CREATE INDEX idx_coupons_active ON shared.coupons (business, coupon_code, valid_from, valid_to)
  WHERE is_active = true;
CREATE INDEX idx_coupons_segment ON shared.coupons (customer_segment_id)
  WHERE customer_segment_id IS NOT NULL;

-- ── coupon_redemptions ───────────────────────────────────
CREATE TABLE shared.coupon_redemptions (
  redemption_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id             UUID        NOT NULL REFERENCES shared.coupons (coupon_id) ON DELETE RESTRICT,
  contact_id            UUID        REFERENCES shared.contacts (contact_id) ON DELETE SET NULL,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  -- The order it was applied to (in the brand schema)
  reference_type        TEXT        NOT NULL CHECK (reference_type IN ('sales_order','pos_transaction','storefront_order')),
  reference_id          UUID        NOT NULL,
  discount_applied      NUMERIC(14,2) NOT NULL,                 -- in NGN, settled
  display_currency      TEXT        REFERENCES shared.currencies (currency_code),
  display_discount      NUMERIC(14,2),                          -- in display currency
  redeemed_ip           INET,
  redeemed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coupon_redemptions_coupon  ON shared.coupon_redemptions (coupon_id, redeemed_at DESC);
CREATE INDEX idx_coupon_redemptions_contact ON shared.coupon_redemptions (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_coupon_redemptions_ref     ON shared.coupon_redemptions (reference_type, reference_id);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ SUBSCRIPTIONS (Wig Subscription Service — Module 6.23.5)           ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── subscription_plans ───────────────────────────────────
CREATE TABLE shared.subscription_plans (
  plan_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  plan_key              TEXT        NOT NULL,                   -- 'pixie_essentials','pixie_premium','pixie_vip'
  display_name          TEXT        NOT NULL,                   -- 'Pixie Essentials'
  description           TEXT,
  billing_cycle         TEXT        NOT NULL CHECK (billing_cycle IN ('monthly','quarterly','annually')),
  -- What the subscriber gets per cycle
  units_per_cycle       SMALLINT    NOT NULL DEFAULT 1,         -- 1 wig / 2 wigs / unlimited maintenance
  -- Pricing — display in NGN; storefront converts at render time
  price_ngn             NUMERIC(14,2) NOT NULL CHECK (price_ngn > 0),
  discount_pct_vs_retail NUMERIC(5,2) NOT NULL DEFAULT 0,       -- "10% off retail" — informational
  -- Selection mode for the customer's monthly drop
  selection_mode        TEXT        NOT NULL DEFAULT 'customer_picks'
                        CHECK (selection_mode IN ('customer_picks','curator_picks','surprise_me')),
  -- Subscriber-only benefits
  benefits              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  display_order         SMALLINT    NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business, plan_key)
);
CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON shared.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();

-- ── subscriptions ────────────────────────────────────────
CREATE TABLE shared.subscriptions (
  subscription_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID        NOT NULL REFERENCES shared.contacts (contact_id) ON DELETE RESTRICT,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  plan_id               UUID        NOT NULL REFERENCES shared.subscription_plans (plan_id),
  status                TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','paused','cancelled','expired','past_due')),
  -- Paystack recurring auth code so the cron job can charge
  paystack_authorization_code TEXT,
  paystack_customer_code TEXT,
  -- Billing
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_billing_at       TIMESTAMPTZ NOT NULL,
  last_billed_at        TIMESTAMPTZ,
  paused_at             TIMESTAMPTZ,
  pause_reason          TEXT,
  resumed_at            TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,
  -- Counters
  total_cycles_billed   INTEGER     NOT NULL DEFAULT 0,
  total_amount_billed_ngn NUMERIC(14,2) NOT NULL DEFAULT 0,
  failed_attempts_in_row SMALLINT    NOT NULL DEFAULT 0,
  -- Customer preferences (texture/length/colour) for curator/surprise picks
  preferences           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Default delivery address for monthly drops
  default_delivery_address_id UUID  REFERENCES shared.contact_addresses (address_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON shared.subscriptions
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_subscriptions_contact    ON shared.subscriptions (contact_id, business);
CREATE INDEX idx_subscriptions_next_bill  ON shared.subscriptions (next_billing_at) WHERE status = 'active';
CREATE INDEX idx_subscriptions_past_due   ON shared.subscriptions (next_billing_at)
  WHERE status IN ('past_due','paused');

-- ── subscription_billing_attempts ────────────────────────
-- Every charge attempt — success or failure. After 3 in-a-row failures
-- the cron pauses the subscription and notifies the team.
CREATE TABLE shared.subscription_billing_attempts (
  attempt_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id       UUID        NOT NULL REFERENCES shared.subscriptions (subscription_id) ON DELETE CASCADE,
  attempted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_ngn            NUMERIC(14,2) NOT NULL,
  paystack_reference    TEXT,
  status                TEXT        NOT NULL
                        CHECK (status IN ('success','failed_card_declined','failed_insufficient_funds',
                                          'failed_authorization_expired','failed_unknown')),
  failure_message       TEXT,
  -- If success, the sales_order created in the brand schema
  created_order_id      UUID,
  created_invoice_id    UUID
);
CREATE INDEX idx_subscription_billing_subscription ON shared.subscription_billing_attempts (subscription_id, attempted_at DESC);

-- ============================================================
-- Verify
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'shared'
-- AND table_name IN ('loyalty_tiers','loyalty_ledger','customer_loyalty_state',
--                     'referrals','referral_redemptions',
--                     'coupons','coupon_redemptions',
--                     'subscription_plans','subscriptions','subscription_billing_attempts');
-- Expected: 10 rows
-- ============================================================
