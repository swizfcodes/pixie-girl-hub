-- ============================================================
-- MIGRATION 000009 — Shared inter-company trade bridge
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- The matched-pair record for every PXG ↔ FLH (or any pair of
-- entities under the same Hub) transaction. The seller-side
-- document lives in the seller's brand schema, the buyer-side
-- document lives in the buyer's brand schema, and BOTH point at
-- one shared.intercompany_transactions row.
--
-- The two trade flows (from the V2 product description):
--   FLOW 1 — Styling: FLH styles a Pixie wig and invoices PXG
--            (Faitlyn books service revenue; PXG books the cost
--            as a landed_cost_components entry against the wig).
--   FLOW 2 — Wholesale: FLH buys a Pixie wig from PXG to sell or
--            install (PXG books wholesale revenue at ≥ min-margin
--            floor; FLH books a purchase + stock-in at cost).
--
-- Tables:
--   intercompany_transactions       — the matched-pair record
--   intercompany_reconciliations    — nightly sweep results
-- ============================================================

-- ── intercompany_transactions ────────────────────────────
-- One row per cross-entity transaction. Created in 'pending' when
-- the seller posts; flipped to 'matched' when the buyer-side
-- document is registered against the same id; 'settled' once both
-- sides' invoices are paid.
CREATE TABLE shared.intercompany_transactions (
  ic_transaction_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sequence number (uses the shared.document_numbering 'intercompany' sequence)
  ic_number             TEXT        NOT NULL UNIQUE,
  flow_type             TEXT        NOT NULL
                        CHECK (flow_type IN ('styling','wholesale','expense_recharge','asset_transfer')),
  -- The two brands involved
  seller_brand          TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE RESTRICT,
  buyer_brand           TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE RESTRICT,
  -- Money
  currency              TEXT        NOT NULL DEFAULT 'NGN' REFERENCES shared.currencies (currency_code),
  amount                NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  amount_ngn            NUMERIC(14,2) NOT NULL CHECK (amount_ngn > 0),
  fx_rate_used          NUMERIC(15,6) NOT NULL DEFAULT 1.000000,
  -- The minimum margin enforced at creation (from buyer_brand's
  -- intercompany_settings.min_margin_floor_pct). Captured for audit
  -- so a later rule change doesn't retroactively invalidate the trade.
  -- NOT NULL: investor-protection floor must be set; reject the trade
  -- otherwise. See Amendment-10 in CHANGELOG (2026-05-27).
  min_margin_floor_pct  NUMERIC(5,2) NOT NULL,
  effective_margin_pct  NUMERIC(5,2),
  -- Seller-side document (always in seller_brand schema)
  seller_doc_type       TEXT        NOT NULL,                   -- 'invoice' for both flows
  seller_doc_id         UUID        NOT NULL,                   -- e.g. pixiegirl.invoices.invoice_id
  seller_doc_number     TEXT        NOT NULL,                   -- 'PXG-INV-0123'
  -- Buyer-side document (in buyer_brand schema). Populated when
  -- the buyer accepts/records the transaction.
  buyer_doc_type        TEXT,                                   -- 'purchase_order' for flow 2; 'expense' or 'landed_cost' for flow 1
  buyer_doc_id          UUID,
  buyer_doc_number      TEXT,
  -- Lifecycle
  status                TEXT        NOT NULL DEFAULT 'pending_buyer'
                        CHECK (status IN ('pending_buyer','matched','settled','disputed','reversed','cancelled')),
  -- Reference to the underlying business object that triggered this
  -- trade (e.g. the production_run that needed styling, or the
  -- sales_order that needed Pixie hair).
  reference_type        TEXT,
  reference_id          UUID,
  -- Description for human readability
  description           TEXT        NOT NULL,
  notes                 TEXT,
  -- Audit
  posted_by             UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE RESTRICT,
  posted_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  matched_at            TIMESTAMPTZ,
  settled_at            TIMESTAMPTZ,
  reversed_at           TIMESTAMPTZ,
  reversed_reason       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ic_seller_buyer_differ CHECK (seller_brand <> buyer_brand)
);
CREATE TRIGGER trg_intercompany_transactions_updated_at
  BEFORE UPDATE ON shared.intercompany_transactions
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ic_tx_status        ON shared.intercompany_transactions (status, posted_at DESC);
CREATE INDEX idx_ic_tx_seller        ON shared.intercompany_transactions (seller_brand, seller_doc_id);
CREATE INDEX idx_ic_tx_buyer         ON shared.intercompany_transactions (buyer_brand, buyer_doc_id)
  WHERE buyer_doc_id IS NOT NULL;
CREATE INDEX idx_ic_tx_pending_buyer ON shared.intercompany_transactions (posted_at)
  WHERE status = 'pending_buyer';
CREATE INDEX idx_ic_tx_reference     ON shared.intercompany_transactions (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ── intercompany_reconciliations ─────────────────────────
-- Nightly sweep result: any row where the seller-side and
-- buyer-side documents disagree on amount, currency, or status is
-- flagged. Settlement is blocked on flagged transactions.
CREATE TABLE shared.intercompany_reconciliations (
  recon_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ic_transaction_id     UUID        NOT NULL REFERENCES shared.intercompany_transactions (ic_transaction_id) ON DELETE CASCADE,
  swept_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- What disagreed
  discrepancy_type      TEXT        NOT NULL
                        CHECK (discrepancy_type IN ('amount_mismatch','currency_mismatch','status_mismatch',
                                                    'missing_buyer_doc','missing_seller_doc','duplicate_match')),
  seller_value          TEXT,                                   -- string form of mismatched value
  buyer_value           TEXT,
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  resolved_by           UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  resolution_notes      TEXT,
  notes                 TEXT
);
CREATE INDEX idx_ic_recon_open ON shared.intercompany_reconciliations (swept_at DESC) WHERE status = 'open';
CREATE INDEX idx_ic_recon_tx   ON shared.intercompany_reconciliations (ic_transaction_id);

-- ============================================================
-- Verify
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'shared' AND table_name LIKE 'intercompany%';
-- Expected: 2 rows
-- ============================================================
