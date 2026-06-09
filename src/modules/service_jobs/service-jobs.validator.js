/**
 * Faitlyn Service Job Tracker (V2.2 §6.24) — Zod validators.
 */

"use strict";

const { z } = require("zod");

const JOB_STATUS = [
  "pending",
  "in_progress",
  "on_hold",
  "completed",
  "rejected",
  "cancelled",
];

const serviceTypeCreate = z
  .object({
    service_key: z.string().min(1).max(60),
    display_name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    standard_cost_ngn: z.coerce.number().nonnegative().optional(),
    standard_turnaround_days: z.coerce.number().int().nonnegative().optional(),
    default_account_id: z.string().uuid().optional(),
    display_order: z.coerce.number().int().optional(),
  })
  .strict();

const serviceTypeUpdate = z
  .object({
    display_name: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).optional(),
    standard_cost_ngn: z.coerce.number().nonnegative().optional(),
    standard_turnaround_days: z.coerce.number().int().nonnegative().optional(),
    default_account_id: z.string().uuid().optional(),
    display_order: z.coerce.number().int().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

const jobCreate = z
  .object({
    service_type_id: z.string().uuid(),
    hair_variant_id: z.string().uuid().optional(),
    hair_unit_id: z.string().uuid().optional(),
    hair_description: z.string().max(500).optional(),
    sales_order_id: z.string().uuid().optional(),
    sales_order_line_id: z.string().uuid().optional(),
    customer_contact_id: z.string().uuid().optional(),
    assigned_staff_user_id: z.string().uuid().optional(),
    assigned_stylist_id: z.string().uuid().optional(),
    is_intercompany: z.boolean().optional(),
    intercompany_transaction_id: z.string().uuid().optional(),
    specification: z.record(z.any()).optional(),
    recipe_id: z.string().uuid().optional(),
    scheduled_for: z.string().datetime().optional(),
    expected_completion_at: z.string().datetime().optional(),
    agreed_cost_ngn: z.coerce.number().nonnegative().optional(),
  })
  .strict();

const jobUpdate = z
  .object({
    hair_variant_id: z.string().uuid().optional(),
    hair_unit_id: z.string().uuid().optional(),
    hair_description: z.string().max(500).optional(),
    assigned_stylist_id: z.string().uuid().optional(),
    specification: z.record(z.any()).optional(),
    recipe_id: z.string().uuid().optional(),
    recipe_override: z.record(z.any()).optional(),
    scheduled_for: z.string().datetime().optional(),
    expected_completion_at: z.string().datetime().optional(),
    agreed_cost_ngn: z.coerce.number().nonnegative().optional(),
  })
  .strict();

const jobAdvance = z
  .object({
    status: z.enum(JOB_STATUS),
    actual_cost_ngn: z.coerce.number().nonnegative().optional(),
  })
  .strict();

const assignStaff = z
  .object({ assigned_staff_user_id: z.string().uuid() })
  .strict();

const outcome = z
  .object({
    quality_rating: z.coerce.number().int().min(1).max(5).optional(),
    quality_notes: z.string().max(2000).optional(),
    customer_rating: z.coerce.number().int().min(1).max(5).optional(),
    customer_feedback: z.string().max(2000).optional(),
  })
  .strict();

const mk = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body || {});
  next();
};

module.exports = {
  validateServiceTypeCreate: mk(serviceTypeCreate),
  validateServiceTypeUpdate: mk(serviceTypeUpdate),
  validateJobCreate: mk(jobCreate),
  validateJobUpdate: mk(jobUpdate),
  validateJobAdvance: mk(jobAdvance),
  validateAssignStaff: mk(assignStaff),
  validateOutcome: mk(outcome),
};
