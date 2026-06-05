/**
 * Weekly Sales Report + Weekly Customer Report (V2.2 §6.30).
 * Runs Saturday 20:00 Africa/Lagos.
 *
 * Process:
 *   1. Generate the report data from logged data (no manual compilation)
 *   2. Use the seeded template from report_templates (weekly_sales_report, weekly_customer_report)
 *   3. Create a report_runs row with status='needs_confirmation'
 *   4. Notify designated staff (Chloe / Ifeoluwa) for review-then-confirm
 *   5. After confirmation, deliver to CEO
 */

"use strict";

const { logger } = require("../../config/logger");

async function runWeeklySalesReport() {
  logger.info("weekly sales report cron triggered");
  // TODO: implement
}

async function runWeeklyCustomerReport() {
  logger.info("weekly customer report cron triggered");
  // TODO: implement
}

module.exports = { runWeeklySalesReport, runWeeklyCustomerReport };
