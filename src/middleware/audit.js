/**
 * Audit log middleware (V2.2 §3 — "Every permission change is logged
 * with date, time, and actor.")
 *
 * Wraps any state-changing action. Captures:
 *   actor       (req.user.user_id)
 *   business    (req.brand)
 *   action_key  ('sales.order.create')
 *   target_type ('sales_order')
 *   target_id   (uuid)
 *   before      (snapshot before mutation, when retrievable)
 *   after       (snapshot after mutation)
 *   ip, user_agent, request_id
 *
 * Writes to shared.audit_log (which is append-only — UPDATE/DELETE
 * blocked by DB trigger).
 *
 * USE: don't apply via Express middleware; call from services where
 *      the before/after snapshots are known. This file exposes the
 *      `audit()` helper, not Express middleware.
 */

"use strict";

const { query } = require("../config/database");
const { logger } = require("../config/logger");
const { config } = require("../config/env");

/**
 * Write one audit row. Never throws — audit failure must not break
 * the user's action (the action itself is already committed).
 */
async function audit({
  business,
  user_id,
  action_key,
  target_type,
  target_id,
  before = null,
  after = null,
  metadata = null,
  request_id = null,
  ip = null,
  user_agent = null,
}) {
  if (!config.ENABLE_AUDIT_LOG) return;
  try {
    await query(
      `INSERT INTO shared.audit_log
         (business, user_id, action_key, target_type, target_id,
          before_state, after_state, metadata, request_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        business,
        user_id,
        action_key,
        target_type,
        target_id,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        metadata ? JSON.stringify(metadata) : null,
        request_id,
        ip,
        user_agent,
      ],
    );
  } catch (err) {
    logger.error({ err, action_key, target_id }, "audit log write failed");
  }
}

module.exports = { audit };
