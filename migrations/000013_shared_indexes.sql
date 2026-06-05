-- ============================================================
-- MIGRATION 000013 — Shared performance indexes
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- Cross-table indexes that don't naturally live with one table.
-- Per-table indexes are declared alongside their tables. This file
-- collects only the indexes that exist because of how multiple
-- modules query in combination.
-- ============================================================

-- ── Contacts: composite priority + assignment lookups ────
-- "Show me all VIP customers I own"
CREATE INDEX idx_contacts_priority_assigned
  ON shared.contacts (assigned_to, priority_level)
  WHERE is_deleted = false;

-- ── Documents: per-business + per-type listings ──────────
-- "All PXG invoices in Q3"
CREATE INDEX idx_documents_business_type_time
  ON shared.documents (business, document_type, created_at DESC)
  WHERE is_deleted = false;

-- ── Audit log: replay by record-then-action ──────────────
-- "Show me the full history of this invoice in order"
CREATE INDEX idx_audit_log_record_time
  ON shared.audit_log (table_name, record_id, occurred_at)
  WHERE record_id IS NOT NULL;

-- ── Webhook log: source + processed for replay sweep ─────
CREATE INDEX idx_webhook_log_source_received
  ON shared.webhook_log (source, received_at DESC);

-- ── Calendar: range scans by participant ─────────────────
CREATE INDEX idx_event_participants_user_event
  ON shared.event_participants (user_id, event_id)
  WHERE user_id IS NOT NULL;

-- ── Tasks: my open queue ─────────────────────────────────
CREATE INDEX idx_tasks_assignee_open
  ON shared.tasks (assigned_to, due_at)
  WHERE is_deleted = false AND status NOT IN ('done','cancelled');

-- ── Loyalty: redemptions per-day analytics ───────────────
CREATE INDEX idx_loyalty_ledger_business_day
  ON shared.loyalty_ledger (business, created_at DESC);

-- ── Referrals: who-referred-whom for fraud review ────────
CREATE INDEX idx_referral_redemptions_device
  ON shared.referral_redemptions ((1))                          -- placeholder used by manual SQL
  WHERE fraud_check_result <> 'passed';
-- (We can't index a TEXT column with WHERE; the above gives us
-- a quick path to "all flagged" rows; deeper anti-fraud queries
-- are served by the existing idx_referral_redemptions_fraud.)

-- ── Coupons: validity-window lookup ──────────────────────
CREATE INDEX idx_coupons_valid_window
  ON shared.coupons (business, valid_from, valid_to)
  WHERE is_active = true;

-- ── Subscriptions: failure analytics ─────────────────────
CREATE INDEX idx_subscription_attempts_failed
  ON shared.subscription_billing_attempts (attempted_at DESC)
  WHERE status <> 'success';

-- ── Stylists: open-offer fanout to candidates ────────────
CREATE INDEX idx_stylist_offers_active_per_stylist
  ON shared.stylist_assignment_offers (stylist_id, offered_at DESC)
  WHERE response = 'pending';

-- ── Stylist payouts: stylist-month dashboard ─────────────
CREATE INDEX idx_stylist_payouts_period
  ON shared.stylist_payouts (period_end DESC, status);

-- ── Intercompany: open pairs older than N days ───────────
-- Driving the alert "stale unmatched IC" — combined with the
-- existing partial index idx_ic_tx_pending_buyer.
CREATE INDEX idx_ic_tx_stale_open
  ON shared.intercompany_transactions (posted_at)
  WHERE status IN ('pending_buyer','matched');

-- ── Storefront pages: routing by path ────────────────────
-- (already covered by idx_storefront_pages_path; this one supports
-- "all published pages for this brand" in the editor.)
CREATE INDEX idx_storefront_pages_business_status
  ON shared.storefront_pages (business, status, page_key);

-- ── Carts: cron sweep for abandonment ────────────────────
-- (already covered by idx_carts_abandoned; this one supports the
-- recovery email job filtering by recovery_email_sent_at IS NULL.)
CREATE INDEX idx_carts_recovery_eligible
  ON shared.carts (last_interaction_at)
  WHERE status = 'abandoned' AND recovery_email_sent_at IS NULL;

-- ── Tracking: rotate-token sweep ─────────────────────────
CREATE INDEX idx_tracking_links_expiring
  ON shared.tracking_links (expires_at)
  WHERE is_active = true AND expires_at IS NOT NULL;

-- ── Order timeline: latest event per order (composite) ───
-- The most common query: "what's the latest event on this order"
-- is served by the existing idx_order_timeline_order index sorted
-- DESC; this one supports "all orders changing state today" for
-- ops dashboards.
CREATE INDEX idx_order_timeline_today
  ON shared.order_timeline_events (business, occurred_at DESC);

-- ── Clock events: today-by-business ──────────────────────
CREATE INDEX idx_clock_events_business_day
  ON shared.staff_clock_events (occurred_at DESC);

-- ── Workflow: per-business pending sweep ─────────────────
CREATE INDEX idx_workflow_instances_business_pending
  ON shared.workflow_instances (business, stage_entered_at DESC)
  WHERE status = 'pending';

-- ── Social posts: scheduling cron lookahead ──────────────
CREATE INDEX idx_social_posts_due_soon
  ON shared.social_posts (scheduled_for)
  WHERE status = 'scheduled';

-- ── Ad spend: ROAS calc per brand+date ───────────────────
CREATE INDEX idx_ad_spend_business_day
  ON shared.ad_spend_daily (metric_date DESC);

-- ── AI usage: per-period running totals ──────────────────
CREATE INDEX idx_ai_usage_period_feature_time
  ON shared.ai_usage_ledger (period_id, feature_key, occurred_at)
  WHERE period_id IS NOT NULL;

-- ── AI insights: cross-category dashboard "all open by severity"
-- requires per-table indexes (already declared). This composite
-- view is built via UNION ALL in the service layer.

-- ── AI briefings: latest unread per user ─────────────────
CREATE INDEX idx_ai_briefings_unread
  ON shared.ai_briefings (recipient_user_id, generated_at DESC)
  WHERE status = 'generated' AND read_at IS NULL;
