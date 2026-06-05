/**
 * Layaway abandonment sweep (V2.2 §6.2).
 * Daily 02:00. Auto-cancels layaway orders where:
 *   payment_model = 'layaway'
 *   AND amount_paid_ngn = 0 (or below threshold)
 *   AND created_at < now() - business_config.layaway_abandonment_days
 *
 * Releases reserved stock, marks order cancelled, sends customer notification.
 */

"use strict";

const { logger } = require("../../config/logger");

async function runLayawayAbandonmentSweep() {
  logger.info("layaway abandonment sweep triggered");
  // TODO: implement once payment_model column lands (Bucket B-2)
}

module.exports = { runLayawayAbandonmentSweep };
