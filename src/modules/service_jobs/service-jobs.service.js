/**
 * Faitlyn Service Job Tracker (V2.2 §6.24) — business logic.
 *
 * Service types + the job lifecycle (pending → in_progress → completed), split
 * out of Production into its own module. System connections:
 *   - sales `order.deposit_met` → createForOrder opens a job (subscriber).
 *   - a job insert fires the DB trigger that raises a staff task.
 *   - `service_jobs.created` is consumed by the Stylist programme to open a
 *     routing assignment; on completion the cost can settle.
 */

"use strict";

const repo = require("./service-jobs.repo");
const events = require("./service-jobs.events");
const { audit } = require("../../middleware/audit");
const { transaction } = require("../../config/database");
const { NotFoundError, AppError } = require("../../utils/errors");

const A = (
  brand,
  user,
  action_key,
  target_type,
  target_id,
  after,
  request_id,
) =>
  audit({
    business: brand,
    user_id: user ? user.user_id : null,
    action_key,
    target_type,
    target_id,
    after,
    request_id,
  });

const JOB_STATUS = [
  "pending",
  "in_progress",
  "on_hold",
  "completed",
  "rejected",
  "cancelled",
];

// ── Service types ──────────────────────────────────────────
function listServiceTypes({ brand, is_active }) {
  return repo.listServiceTypes({ brand, is_active });
}
async function createServiceType({ brand, user, request_id, input }) {
  const st = await repo.createServiceType({ brand, st: input });
  await A(
    brand,
    user,
    "service_jobs.type.create",
    "service_type",
    st.service_type_id,
    { service_key: st.service_key },
    request_id,
  );
  return st;
}
async function updateServiceType({ brand, user, request_id, id, patch }) {
  const before = await repo.findServiceType({ brand, id });
  if (!before) throw new NotFoundError("Service type");
  const updated = await repo.updateServiceType({ brand, id, patch });
  await A(
    brand,
    user,
    "service_jobs.type.update",
    "service_type",
    id,
    updated,
    request_id,
  );
  return updated;
}

// ── Jobs ───────────────────────────────────────────────────
function listJobs(args) {
  return repo.listServiceJobs(args);
}
async function getJob({ brand, id }) {
  const job = await repo.getServiceJob({ brand, id });
  if (!job) throw new NotFoundError("Service job");
  return job;
}
async function createJob({ brand, user, request_id, input }) {
  return transaction(async (client) => {
    const job_number = await repo.nextNumber({
      client,
      brand,
      type: "service_job",
    });
    const job = await repo.createServiceJob({
      client,
      brand,
      job: { ...input, job_number, created_by: user.user_id },
    });
    await A(
      brand,
      user,
      "service_jobs.create",
      "service_job",
      job.job_id,
      { job_number },
      request_id,
    );
    events.emit("created", { brand, job_id: job.job_id });
    return job;
  });
}
async function updateJob({ brand, user, request_id, id, patch }) {
  return transaction(async (client) => {
    const before = await repo.getServiceJob({ client, brand, id });
    if (!before) throw new NotFoundError("Service job");
    const job = await repo.updateServiceJob({ client, brand, id, patch });
    await A(
      brand,
      user,
      "service_jobs.update",
      "service_job",
      id,
      job,
      request_id,
    );
    return job;
  });
}

/**
 * Advance the job status machine. Stamps lifecycle timestamps and emits
 * `advanced` (and `completed` on the terminal transition).
 */
async function advanceJob({
  brand,
  user,
  request_id,
  id,
  status,
  actual_cost_ngn,
}) {
  if (!JOB_STATUS.includes(status))
    throw new AppError("BAD_STATUS", `Unknown status ${status}`, 422);
  return transaction(async (client) => {
    const before = await repo.getServiceJob({ client, brand, id });
    if (!before) throw new NotFoundError("Service job");
    const fields = {};
    if (actual_cost_ngn !== undefined && actual_cost_ngn !== null)
      fields.actual_cost_ngn = actual_cost_ngn;
    if (status === "in_progress" && !before.started_at)
      fields.started_at = new Date().toISOString();
    if (status === "completed") fields.completed_at = new Date().toISOString();
    if (status === "cancelled") fields.cancelled_at = new Date().toISOString();
    const job = await repo.setServiceJobStatus({
      client,
      brand,
      id,
      status,
      fields,
    });
    await A(
      brand,
      user,
      "service_jobs.advance",
      "service_job",
      id,
      { from: before.status, to: status },
      request_id,
    );
    events.emit("advanced", { brand, job_id: id, status });
    if (status === "completed") events.emit("completed", { brand, job_id: id });
    return job;
  });
}

async function assignStaff({
  brand,
  user,
  request_id,
  id,
  assigned_staff_user_id,
}) {
  const before = await repo.getServiceJob({ brand, id });
  if (!before) throw new NotFoundError("Service job");
  const job = await repo.updateServiceJob({
    brand,
    id,
    patch: { assigned_staff_user_id },
  });
  await A(
    brand,
    user,
    "service_jobs.assign_staff",
    "service_job",
    id,
    { assigned_staff_user_id },
    request_id,
  );
  events.emit("assigned", { brand, job_id: id });
  return job;
}

async function recordOutcome({ brand, user, request_id, id, input }) {
  const before = await repo.getServiceJob({ brand, id });
  if (!before) throw new NotFoundError("Service job");
  const fields = {};
  if (input.quality_rating !== undefined)
    fields.quality_rating = input.quality_rating;
  if (input.quality_notes !== undefined)
    fields.quality_notes = input.quality_notes;
  if (input.customer_rating !== undefined)
    fields.customer_rating = input.customer_rating;
  if (input.customer_feedback !== undefined)
    fields.customer_feedback = input.customer_feedback;
  const job = await repo.setServiceJobStatus({
    brand,
    id,
    status: before.status,
    fields,
  });
  await A(
    brand,
    user,
    "service_jobs.outcome",
    "service_job",
    id,
    fields,
    request_id,
  );
  return job;
}

/**
 * Open a styling job for a deposit-triggered (custom) order once the deposit
 * clears. No-ops if the brand runs no service types or a job already exists.
 * Called best-effort by the order.deposit_met subscriber.
 */
async function createForOrder({ brand, order }) {
  if (!order) return null;
  return transaction(async (client) => {
    if (
      await repo.serviceJobExistsForOrder({
        client,
        brand,
        order_id: order.order_id,
      })
    )
      return null;
    const st = await repo.getDefaultServiceType({ client, brand });
    if (!st) return null; // brand runs no styling services (e.g. PXG)
    const firstLine = (order.lines || [])[0] || {};
    const job_number = await repo.nextNumber({
      client,
      brand,
      type: "service_job",
    });
    const job = await repo.createServiceJob({
      client,
      brand,
      job: {
        job_number,
        service_type_id: st.service_type_id,
        hair_variant_id: firstLine.variant_id || null,
        sales_order_id: order.order_id,
        customer_contact_id: order.contact_id,
        status: "pending",
        agreed_cost_ngn: st.standard_cost_ngn,
      },
    });
    await A(
      brand,
      null,
      "service_jobs.from_order",
      "service_job",
      job.job_id,
      { order_id: order.order_id },
      null,
    );
    events.emit("created", {
      brand,
      job_id: job.job_id,
      order_id: order.order_id,
    });
    return job;
  });
}

module.exports = {
  listServiceTypes,
  createServiceType,
  updateServiceType,
  listJobs,
  getJob,
  createJob,
  updateJob,
  advanceJob,
  assignStaff,
  recordOutcome,
  createForOrder,
};
