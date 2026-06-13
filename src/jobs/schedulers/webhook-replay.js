/**
 * Webhook replay sweep (H-4).
 * Runs every 30 minutes. Finds signature-valid inbound webhooks that never
 * finished processing (processed = false) — e.g. their outbox retries were
 * exhausted, or a downstream consumer was down when the event arrived — and
 * hands them to the `webhooks-replay` queue to be re-driven.
 *
 * Webhooks are shared (not brand-scoped) at receive, so this does not fan out
 * across brands; brand context is resolved per-event from the payload metadata
 * inside recordGatewayPayment. Re-processing is idempotent, and the retry_count
 * cap in listReplayable stops a permanently-broken event from looping forever.
 */

"use strict";

const { logger } = require("../../config/logger");
const webhooks = require("../../modules/business_setup/webhooks.service");

async function runWebhookReplaySweep() {
  try {
    const ids = await webhooks.enqueueReplay({ limit: 200, maxRetries: 25 });
    logger.info({ enqueued: ids.length }, "webhook-replay sweep complete");
    return { enqueued: ids.length };
  } catch (err) {
    logger.error({ err: err.message }, "webhook-replay sweep failed");
    return { enqueued: 0 };
  }
}

module.exports = { runWebhookReplaySweep };
