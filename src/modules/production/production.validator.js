/**
 * Production & Landed Cost (V2.2 §6.24) — Zod validators.
 */

"use strict";

const { z } = require("zod");

const RUN_STATUS = [
  "planned",
  "funded",
  "in_production",
  "quality_check",
  "ready_to_ship",
  "in_transit",
  "arrived_lagos",
  "cleared_customs",
  "received",
  "completed",
  "cancelled",
];
const runCreate = z
  .object({
    title: z.string().min(1).max(200),
    status: z.enum(RUN_STATUS).optional(),
    units_planned: z.coerce.number().int().min(0).optional(),
  })
  .strict();

const runAdvance = z.object({ status: z.enum(RUN_STATUS) }).strict();

const costAdd = z
  .object({
    cost_type: z.string().min(1).max(40),
    amount: z.coerce.number().positive(),
    currency: z.string().length(3),
    fx_rate_used: z.coerce.number().positive().optional(),
    amount_ngn: z.coerce.number().positive().optional(),
    incurred_at: z.string().date().optional(),
  })
  .strict();

const unitAdd = z
  .object({
    variant_id: z.string().uuid().optional(),
    status: z.string().max(40).optional(),
  })
  .strict();

const receive = z
  .object({
    variant_id: z.string().uuid(),
    location_id: z.string().uuid(),
    quantity: z.coerce.number().int().positive(),
    unit_cost_ngn: z.coerce.number().nonnegative().optional(),
  })
  .strict();

const reworkAdd = z
  .object({
    reason: z.string().min(1).max(500),
    qc_finding: z.string().max(500).optional(),
    extra_cost_ngn: z.coerce.number().nonnegative().optional(),
    delay_days: z.coerce.number().int().nonnegative().optional(),
    outcome: z.enum(["passed", "still_failing", "scrapped"]).optional(),
    rework_completed_at: z.string().datetime().optional(),
    incurred_at: z.string().date().optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const mk = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body || {});
  next();
};

module.exports = {
  validateRunCreate: mk(runCreate),
  validateRunAdvance: mk(runAdvance),
  validateCostAdd: mk(costAdd),
  validateUnitAdd: mk(unitAdd),
  validateReceive: mk(receive),
  validateReworkAdd: mk(reworkAdd),
};
