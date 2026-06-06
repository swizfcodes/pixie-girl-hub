/**
 * Approvals + workflow-definition input validators (Zod).
 *
 * The stage schema accepts every authored threshold form the engine
 * understands (see workflows/conditions.js): the canonical `condition`,
 * the WORKFLOWS.md `threshold_field` + `threshold_ngn_*` bounds, and the
 * legacy single `amount_threshold_ngn`.
 */

"use strict";

const { z } = require("zod");

const actSchema = z.object({
  action: z.enum(["approve", "reject", "request_changes"]),
  notes: z.string().max(2000).optional(),
});

const approverSchema = z.object({
  type: z.enum(["role", "position", "user"]),
  value: z.string().min(1),
});

const conditionSchema = z.object({
  field: z.string().min(1),
  gt: z.number().optional(),
  gte: z.number().optional(),
  lt: z.number().optional(),
  lte: z.number().optional(),
  eq: z.any().optional(),
  in: z.array(z.any()).optional(),
});

const stageSchema = z.object({
  order: z.number().int().positive(),
  name: z.string().max(160).optional(),
  approvers: z.array(approverSchema).min(1),
  // Canonical or aliased condition
  condition: z.union([conditionSchema, z.array(conditionSchema)]).optional(),
  applies_when: z.union([conditionSchema, z.array(conditionSchema)]).optional(),
  // WORKFLOWS.md threshold form
  threshold_field: z.string().min(1).optional(),
  threshold_ngn_gt: z.number().nonnegative().optional(),
  threshold_ngn_gte: z.number().nonnegative().optional(),
  threshold_ngn_lte: z.number().nonnegative().optional(),
  threshold_ngn_lt: z.number().nonnegative().optional(),
  // Legacy single bound
  amount_threshold_ngn: z.number().nonnegative().nullable().optional(),
  timeout_hours: z.number().int().positive().max(720).optional(),
  on_timeout: z.enum(["escalate", "auto_approve", "auto_reject"]).optional(),
  fallback_to_deputy: z.boolean().optional(),
});

const definitionSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  trigger_module: z.string().min(1).max(60),
  trigger_action: z.string().min(1).max(60),
  definition: z.object({
    trigger: z.object({ module: z.string(), action: z.string() }).optional(),
    conditions: z.record(z.any()).optional(),
    stages: z.array(stageSchema).min(1),
  }),
});

function make(schema) {
  return function validate(req, _res, next) {
    req.body = schema.parse(req.body || {});
    next();
  };
}

module.exports = {
  validateAct: make(actSchema),
  validateDefinition: make(definitionSchema),
  validateDefinitionActive: make(z.object({ is_active: z.boolean() })),
  actSchema,
  definitionSchema,
};
