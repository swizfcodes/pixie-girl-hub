-- ============================================================
-- MIGRATION 000205 — Webhook dedup key (H-4 / R-3 / D-1)
--
-- The inbound webhook receiver persists every (signature-verified) callback to
-- shared.webhook_log and must reject a re-delivery of the same event (gateways
-- retry aggressively). Add an `external_id` (the gateway's own event id) and a
-- partial UNIQUE on (source, external_id) so a duplicate delivery is a no-op
-- instead of a double-confirm.
--
-- Idempotent / re-runnable.
-- ============================================================

ALTER TABLE shared.webhook_log
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_log_source_external
  ON shared.webhook_log (source, external_id)
  WHERE external_id IS NOT NULL;
