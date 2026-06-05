-- ============================================================
-- MIGRATION 000006 — Shared audit log
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- audit_log — APPEND-ONLY. The hub_app role has INSERT only.
-- Updates and deletes are blocked by trigger trg_audit_protect
-- (migration 000013) AND by the GRANT/REVOKE in this file.
-- ============================================================

-- ── audit_log ────────────────────────────────────────────
CREATE TABLE shared.audit_log (
  log_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Snapshot fields — NOT foreign keys, user records can be deleted
  user_id               UUID,
  user_name             TEXT        NOT NULL,
  user_email            CITEXT,
  user_class            TEXT,                                  -- 'staff','customer','stylist','system'
  business              TEXT        NOT NULL,
  -- What happened
  module                TEXT        NOT NULL,
  action                TEXT        NOT NULL,
  -- Actions: create | update | delete | login | logout | password_change
  --          permission_change | export | approve | reject | print
  --          email_sent | tampering_detected | rate_limited
  --          workflow_initiated | workflow_decided
  --          fx_override | intercompany_match | intercompany_unmatch
  table_name            TEXT,
  record_id             UUID,
  -- Full row snapshots
  before_state          JSONB,                                 -- NULL for creates
  after_state           JSONB,                                 -- NULL for deletes
  -- Request context
  ip_address            INET,
  user_agent            TEXT,
  session_id            TEXT,                                  -- JWT jti claim
  -- Marker for high-sensitivity events (mass deletes, brand creation,
  -- permission grants, payroll export, etc.). Drives a separate
  -- review queue in the admin.
  is_sensitive          BOOLEAN     NOT NULL DEFAULT false,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb
);

-- Performance indexes — this table grows fast
CREATE INDEX idx_audit_log_occurred ON shared.audit_log (occurred_at DESC);
CREATE INDEX idx_audit_log_record   ON shared.audit_log (table_name, record_id) WHERE record_id IS NOT NULL;
CREATE INDEX idx_audit_log_user     ON shared.audit_log (user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_log_module   ON shared.audit_log (business, module, occurred_at DESC);
CREATE INDEX idx_audit_log_action   ON shared.audit_log (action, occurred_at DESC);
CREATE INDEX idx_audit_log_sensitive ON shared.audit_log (occurred_at DESC) WHERE is_sensitive = true;

-- Revoke UPDATE and DELETE from hub_app on audit_log
-- (hub_auditor has INSERT only via 000001 default privileges)
REVOKE UPDATE, DELETE ON shared.audit_log FROM hub_app;

-- ============================================================
-- Verify
-- SELECT COUNT(*) FROM information_schema.tables
-- WHERE table_schema = 'shared' AND table_name = 'audit_log';
-- Expected: 1
-- ============================================================
