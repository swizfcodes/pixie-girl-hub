/**
 * Production subscribers — intentionally empty.
 *
 * The previous G-1 connection (`order.deposit_met` → open a styling service
 * job) moved to the standalone Service Jobs module when service_jobs was split
 * out of Production. See src/modules/service_jobs/service-jobs.subscribers.js.
 * Kept as a no-op so nothing that historically imported it breaks.
 */

"use strict";

function register() {
  // no-op — see service-jobs.subscribers
}

module.exports = { register };
