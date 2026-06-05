-- ============================================================
-- MIGRATION 000011 — Shared social media + ad analytics
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- Social posts (Module 6.14) and ad campaigns (Module 6.15) live in
-- `shared` because the same Instagram account / Meta Ads account may
-- promote either brand depending on the campaign. The business
-- column scopes each row to a specific brand.
--
-- Tables:
--   social_accounts        — connected Instagram / Facebook / TikTok / YouTube
--   social_posts           — scheduled + published posts
--   social_post_metrics    — daily engagement pull
--   ad_accounts            — connected Google Ads / Meta Ads accounts
--   ad_campaigns           — campaign metadata
--   ad_spend_daily         — daily metrics pull
-- ============================================================

-- ── social_accounts ──────────────────────────────────────
-- Connected social channels. OAuth tokens stored encrypted at the
-- app layer (AES-256). The refresh_token field holds the encrypted
-- ciphertext; rotation is the app's responsibility.
CREATE TABLE shared.social_accounts (
  account_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  platform              TEXT        NOT NULL
                        CHECK (platform IN ('instagram','facebook','tiktok','youtube')),
  handle                TEXT        NOT NULL,                    -- '@pixiegirlglobal'
  external_account_id   TEXT        NOT NULL,                    -- Instagram Business Account ID / FB Page ID / etc.
  access_token_enc      TEXT,                                    -- AES-256 ciphertext
  refresh_token_enc     TEXT,
  token_expires_at      TIMESTAMPTZ,
  scopes                TEXT[]      NOT NULL DEFAULT '{}',
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  connected_by          UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business, platform, external_account_id)
);
CREATE TRIGGER trg_social_accounts_updated_at
  BEFORE UPDATE ON shared.social_accounts
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_social_accounts_business ON shared.social_accounts (business, platform)
  WHERE is_active = true;

-- ── social_posts ─────────────────────────────────────────
CREATE TABLE shared.social_posts (
  post_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  account_id            UUID        NOT NULL REFERENCES shared.social_accounts (account_id) ON DELETE RESTRICT,
  platform              TEXT        NOT NULL
                        CHECK (platform IN ('instagram','facebook','tiktok','youtube')),
  post_type             TEXT        NOT NULL
                        CHECK (post_type IN ('image','carousel','video','reel','story','short')),
  -- Content
  caption               TEXT,
  hashtags              TEXT[]      NOT NULL DEFAULT '{}',
  media_urls            TEXT[]      NOT NULL DEFAULT '{}',
  -- For shoppable posts: linked products (soft FK into business schema)
  tagged_product_ids    UUID[]      NOT NULL DEFAULT '{}',
  -- Scheduling
  status                TEXT        NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','scheduled','publishing','published','failed','deleted')),
  scheduled_for         TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  -- After publish: the external platform's post ID + canonical URL
  external_post_id      TEXT,
  external_url          TEXT,
  -- Publish failure tracking
  failure_message       TEXT,
  retry_count           SMALLINT    NOT NULL DEFAULT 0,
  -- A/B variant linkage (optional)
  parent_post_id        UUID        REFERENCES shared.social_posts (post_id) ON DELETE SET NULL,
  -- Author
  created_by            UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE RESTRICT,
  approved_by           UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_social_posts_updated_at
  BEFORE UPDATE ON shared.social_posts
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_social_posts_business    ON shared.social_posts (business, status);
CREATE INDEX idx_social_posts_scheduled   ON shared.social_posts (scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX idx_social_posts_published   ON shared.social_posts (business, platform, published_at DESC)
  WHERE status = 'published';
CREATE INDEX idx_social_posts_external    ON shared.social_posts (external_post_id)
  WHERE external_post_id IS NOT NULL;

-- ── social_post_metrics ──────────────────────────────────
-- Daily roll-up of engagement metrics. The metrics-sync cron pulls
-- per-platform stats and upserts one row per post per day.
CREATE TABLE shared.social_post_metrics (
  metric_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id               UUID        NOT NULL REFERENCES shared.social_posts (post_id) ON DELETE CASCADE,
  metric_date           DATE        NOT NULL,
  impressions           INTEGER     NOT NULL DEFAULT 0,
  reach                 INTEGER     NOT NULL DEFAULT 0,
  likes                 INTEGER     NOT NULL DEFAULT 0,
  comments              INTEGER     NOT NULL DEFAULT 0,
  shares                INTEGER     NOT NULL DEFAULT 0,
  saves                 INTEGER     NOT NULL DEFAULT 0,
  video_views           INTEGER     NOT NULL DEFAULT 0,
  video_completion_rate NUMERIC(5,2),
  link_clicks           INTEGER     NOT NULL DEFAULT 0,
  profile_visits        INTEGER     NOT NULL DEFAULT 0,
  follows_from_post     INTEGER     NOT NULL DEFAULT 0,
  -- Last time these numbers were refreshed by the cron
  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, metric_date)
);
CREATE INDEX idx_social_metrics_date ON shared.social_post_metrics (metric_date DESC);
CREATE INDEX idx_social_metrics_post ON shared.social_post_metrics (post_id, metric_date DESC);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ AD ANALYTICS (Module 6.15) — Google Ads + Meta Ads                 ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── ad_accounts ──────────────────────────────────────────
CREATE TABLE shared.ad_accounts (
  ad_account_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  platform              TEXT        NOT NULL CHECK (platform IN ('google_ads','meta_ads')),
  external_account_id   TEXT        NOT NULL,                    -- Google Ads customer ID / Meta Ad Account ID
  display_name          TEXT        NOT NULL,
  currency              TEXT        NOT NULL REFERENCES shared.currencies (currency_code),
  access_token_enc      TEXT,
  refresh_token_enc     TEXT,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  connected_by          UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business, platform, external_account_id)
);
CREATE TRIGGER trg_ad_accounts_updated_at
  BEFORE UPDATE ON shared.ad_accounts
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();

-- ── ad_campaigns ─────────────────────────────────────────
CREATE TABLE shared.ad_campaigns (
  ad_campaign_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  ad_account_id         UUID        NOT NULL REFERENCES shared.ad_accounts (ad_account_id) ON DELETE RESTRICT,
  platform              TEXT        NOT NULL CHECK (platform IN ('google_ads','meta_ads')),
  external_campaign_id  TEXT        NOT NULL,
  name                  TEXT        NOT NULL,
  objective             TEXT,                                    -- 'sales','awareness','traffic','engagement'
  status                TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('draft','active','paused','ended','removed')),
  -- Budget
  budget_amount         NUMERIC(14,2),
  budget_currency       TEXT        REFERENCES shared.currencies (currency_code),
  budget_type           TEXT        CHECK (budget_type IN ('daily','lifetime')),
  -- Scheduling
  start_date            DATE,
  end_date              DATE,
  -- Linked content
  landing_page_url      TEXT,
  -- Lifecycle from external platform
  external_created_at   TIMESTAMPTZ,
  last_external_sync_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ad_account_id, external_campaign_id)
);
CREATE TRIGGER trg_ad_campaigns_updated_at
  BEFORE UPDATE ON shared.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ad_campaigns_business ON shared.ad_campaigns (business, status, start_date DESC);

-- ── ad_spend_daily ───────────────────────────────────────
-- One row per campaign per day. Refreshed nightly.
CREATE TABLE shared.ad_spend_daily (
  spend_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_campaign_id        UUID        NOT NULL REFERENCES shared.ad_campaigns (ad_campaign_id) ON DELETE CASCADE,
  metric_date           DATE        NOT NULL,
  -- Spend (in native currency from the ad account)
  spend_amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  spend_currency        TEXT        REFERENCES shared.currencies (currency_code),
  -- NGN equivalent for unified ROAS reporting
  spend_ngn             NUMERIC(14,2) NOT NULL DEFAULT 0,
  fx_rate_used          NUMERIC(15,6),
  -- Performance metrics
  impressions           INTEGER     NOT NULL DEFAULT 0,
  clicks                INTEGER     NOT NULL DEFAULT 0,
  conversions           INTEGER     NOT NULL DEFAULT 0,
  conversion_value      NUMERIC(14,2) NOT NULL DEFAULT 0,
  conversion_value_ngn  NUMERIC(14,2) NOT NULL DEFAULT 0,
  ctr                   NUMERIC(7,4),                            -- clicks/impressions
  cpc                   NUMERIC(14,2),                           -- spend/clicks (native currency)
  cpc_ngn               NUMERIC(14,2),
  roas                  NUMERIC(8,4),                            -- conversion_value/spend
  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ad_campaign_id, metric_date)
);
CREATE INDEX idx_ad_spend_date     ON shared.ad_spend_daily (metric_date DESC);
CREATE INDEX idx_ad_spend_campaign ON shared.ad_spend_daily (ad_campaign_id, metric_date DESC);

-- ============================================================
-- Verify
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'shared'
-- AND table_name LIKE 'social_%' OR table_name LIKE 'ad_%';
-- Expected: 6 rows
-- ============================================================
