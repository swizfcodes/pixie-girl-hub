/**
 * Praxis pending-action expiry sweep.
 * Every 15 minutes. Marks unconfirmed ai_pending_actions as expired
 * once past their expires_at, preventing stale confirmations.
 */

"use strict";

const { logger } = require("../../config/logger");
const { query } = require("../../config/database");

async function runPendingActionExpirySweep() {
  const { rowCount } = await query(
    `UPDATE shared.ai_pending_actions
        SET status = 'expired', updated_at = now()
      WHERE status = 'pending'
        AND expires_at < now()`,
  );
  if (rowCount > 0)
    logger.info({ expired: rowCount }, "ai pending actions expired");
}

module.exports = { runPendingActionExpirySweep };
