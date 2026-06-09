/**
 * Stylist subscriber — connect Production (§6.24) to the partner programme.
 *
 * When a styling service_job is created with a customer but no in-house owner
 * (no assigned staff and no stylist yet), open a routing assignment so the job
 * surfaces in the stylist dispatch queue. Best-effort + idempotent: skips jobs
 * that are internal, already routed, or already have an assignment.
 * Registered once.
 */

"use strict";

const productionEvents = require("../production/production.events");
const repo = require("./stylist.repo");
const service = require("./stylist.service");
const { logger } = require("../../config/logger");

let registered = false;

function register() {
  if (registered) return;
  registered = true;
  productionEvents.on("service_job.created", async ({ brand, job_id }) => {
    try {
      const job = await repo.getServiceJob({ brand, job_id });
      if (!job) return;
      // Only route genuinely unassigned, customer-facing jobs to partners.
      if (!job.customer_contact_id) return;
      if (job.assigned_stylist_id || job.assigned_staff_user_id) return;
      // Idempotency: don't open a second assignment for the same job.
      const existing = await repo.listAssignments({
        business: brand,
        customer_contact_id: job.customer_contact_id,
      });
      if (
        existing.some(
          (a) =>
            a.reference_type === "service_booking" && a.reference_id === job_id,
        )
      )
        return;

      await service.openAssignment({
        brand,
        user: null,
        request_id: null,
        input: {
          customer_contact_id: job.customer_contact_id,
          reference_type: "service_booking",
          reference_id: job_id,
          service_key: "styling",
          base_rate: job.agreed_cost_ngn,
          scheduled_at: job.scheduled_for,
          candidate_stylist_ids: [],
        },
      });
    } catch (err) {
      logger.error(
        { err: err.message, brand, job_id },
        "stylist: auto-open assignment on service_job.created failed",
      );
    }
  });
  logger.info(
    "stylist subscribers registered (production.service_job.created → routing assignment)",
  );
}

register();

module.exports = { register };
