/**
 * Workflow timeout sweep (V2.2 §6.27 — continuity / deputy & escalation).
 *
 * Runs every 10 minutes. Finds pending workflow instances whose current
 * stage has passed its `stage_timeout_at` and applies that stage's
 * `on_timeout` policy via the engine:
 *   escalate (default) — re-arm the timer + emit workflow.escalated (re-notify)
 *   auto_approve       — advance / complete as 'timeout_approved'
 *   auto_reject        — terminate as 'timeout_rejected'
 *
 * The engine owns the per-instance transaction and locking; this sweeper
 * only selects the due IDs and drives them one at a time so a single bad
 * instance can't fail the whole batch.
 */

"use strict";

const { query } = require("../../config/database");
const { logger } = require("../../config/logger");
const wf = require("../../workflows/engine");

const BATCH_LIMIT = 200;

async function runWorkflowTimeoutSweep() {
  const { rows } = await query(
    `SELECT instance_id
       FROM shared.workflow_instances
      WHERE status = 'pending'
        AND stage_timeout_at IS NOT NULL
        AND stage_timeout_at <= now()
      ORDER BY stage_timeout_at ASC
      LIMIT $1`,
    [BATCH_LIMIT],
  );

  if (rows.length === 0) return { swept: 0 };

  let resolved = 0;
  for (const { instance_id } of rows) {
    try {
      const result = await wf.resolveTimeout({ instance_id });
      if (result) resolved += 1;
    } catch (err) {
      logger.error({ err, instance_id }, "workflow timeout resolution failed");
    }
  }

  logger.info({ due: rows.length, resolved }, "workflow timeout sweep done");
  return { swept: resolved };
}

module.exports = { runWorkflowTimeoutSweep };
