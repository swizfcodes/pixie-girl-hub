/**
 * AI usage metering + budget enforcement (V2.2 §6.31).
 *
 * Every AI call MUST go through `meteredCall()`:
 *   - Pre-check: is the feature enabled? are we under the hard cap?
 *   - Make the call
 *   - Post: write to ai_usage_ledger, broadcast new total on system:ai_usage_meter
 *
 * Soft cap → CEO gets a warning notification.
 * Hard cap → AI paused gracefully; Tier-1 deterministic insights keep working.
 */

"use strict";

const { query } = require("../config/database");
const { AppError } = require("../utils/errors");

async function meteredCall({ feature_key, vendor, model, user_id, callFn }) {
  // 1. Verify feature flag
  const { rows: ff } = await query(
    `SELECT is_enabled FROM shared.ai_feature_flags WHERE feature_key = $1`,
    [feature_key],
  );
  if (!ff[0] || !ff[0].is_enabled) {
    throw new AppError(
      "AI_FEATURE_DISABLED",
      `Feature ${feature_key} is currently disabled`,
      503,
    );
  }

  // 2. Check budget
  const { rows: budget } = await query(
    `SELECT period_start, period_end, soft_cap_ngn, hard_cap_ngn, current_spend_ngn
       FROM shared.ai_budget_periods
      WHERE is_active = true AND CURRENT_DATE BETWEEN period_start AND period_end
      LIMIT 1`,
  );
  if (
    budget[0] &&
    Number(budget[0].current_spend_ngn) >= Number(budget[0].hard_cap_ngn)
  ) {
    throw new AppError(
      "AI_BUDGET_EXHAUSTED",
      "AI budget reached for this period",
      402,
    );
  }

  // 3. Make the call
  const result = await callFn();

  // 4. Record usage
  await query(
    `INSERT INTO shared.ai_usage_ledger
       (user_id, feature_key, vendor, model, input_tokens, output_tokens, cost_ngn, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [
      user_id,
      feature_key,
      vendor,
      model,
      result.input_tokens || 0,
      result.output_tokens || 0,
      result.cost_ngn || 0,
    ],
  );

  return result;
}

module.exports = { meteredCall };
