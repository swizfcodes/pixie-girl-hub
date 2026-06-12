/**
 * Monthly chemical reconciliation (F-7e / PD §6.24 + §6.30 anti-pocketing).
 * Runs on the 2nd of each month (03:30 Africa/Lagos). For every brand, finds
 * fiscal periods that ended in the last 40 days (and aren't locked) and
 * reconciles system-derived chemical consumption against the admin-recorded
 * purchased/disposed quantities, flagging negative or large variances.
 * Idempotent per (period, chemical, unit) — safe to re-run.
 */

"use strict";

const { logger } = require("../../config/logger");
const serviceJobs = require("../../modules/service_jobs/service-jobs.service");

async function runChemicalReconciliation() {
  try {
    return await serviceJobs.runMonthlyChemicalReconciliation();
  } catch (err) {
    logger.error({ err: err.message }, "chemical reconciliation sweep failed");
    return { reconciled: 0 };
  }
}

module.exports = { runChemicalReconciliation };
