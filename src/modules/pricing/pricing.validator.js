/**
 * Pricing Engine (V2.2 §6.25) — Zod validators.
 */

"use strict";

const { z } = require("zod");

const CHANNEL = [
  "storefront",
  "pos",
  "wholesale",
  "partner",
  "intercompany",
  "all",
];
const RULE_TYPE = [
  "markup_pct",
  "target_margin_pct",
  "fixed_price",
  "discount_pct",
  "min_price",
  "cost_pass_through",
  "tiered_quantity",
];
const FLOOR_TYPE = ["min_price_ngn", "min_margin_pct", "min_markup_pct"];
const OVERRIDE_CHANNEL = [
  "storefront",
  "pos",
  "wholesale",
  "partner",
  "intercompany",
  "instagram",
];

const ruleCreate = z
  .object({
    rule_name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    category_id: z.string().uuid().optional(),
    product_id: z.string().uuid().optional(),
    variant_id: z.string().uuid().optional(),
    channel: z.enum(CHANNEL).optional(),
    rule_type: z.enum(RULE_TYPE),
    rule_value: z.coerce.number().optional(),
    rule_config: z.record(z.any()).optional(),
    applies_to_currency: z.string().length(3).optional(),
    priority: z.coerce.number().int().min(0).max(32000).optional(),
    valid_from: z.string().date().optional(),
    valid_to: z.string().date().optional(),
  })
  .strict();

const ruleUpdate = z
  .object({
    rule_name: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).optional(),
    channel: z.enum(CHANNEL).optional(),
    rule_type: z.enum(RULE_TYPE).optional(),
    rule_value: z.coerce.number().optional(),
    rule_config: z.record(z.any()).optional(),
    applies_to_currency: z.string().length(3).optional(),
    priority: z.coerce.number().int().min(0).max(32000).optional(),
    valid_from: z.string().date().optional(),
    valid_to: z.string().date().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

const floorSet = z
  .object({
    variant_id: z.string().uuid().optional(),
    product_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    channel: z.string().max(20).optional(),
    floor_type: z.enum(FLOOR_TYPE),
    floor_value: z.coerce.number().nonnegative(),
    reason: z.string().max(500).optional(),
    is_intercompany_floor: z.boolean().optional(),
    expires_at: z.string().datetime().optional(),
  })
  .strict();

const overrideSet = z
  .object({
    variant_id: z.string().uuid(),
    channel: z.enum(OVERRIDE_CHANNEL),
    override_price_ngn: z.coerce.number().nonnegative(),
    reason: z.string().min(1).max(500),
    effective_from: z.string().datetime().optional(),
    effective_to: z.string().datetime().optional(),
    approved_by: z.string().uuid().optional(),
  })
  .strict();

const scenarioCreate = z
  .object({
    scenario_name: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    scope_type: z
      .enum([
        "all_active",
        "category",
        "specific_products",
        "specific_variants",
      ])
      .optional(),
    category_ids: z.array(z.string().uuid()).optional(),
    variant_ids: z.array(z.string().uuid()).optional(),
    goal_type: z.enum([
      "target_margin",
      "target_price",
      "target_revenue",
      "sensitivity_only",
    ]),
    goal_value: z.coerce.number().optional(),
    goal_currency: z.string().length(3).optional(),
    channel: z
      .enum(["storefront", "pos", "wholesale", "partner", "intercompany"])
      .optional(),
    assumed_monthly_units: z.coerce.number().int().nonnegative().optional(),
    cost_basis: z.enum(["latest", "average", "last_run", "custom"]).optional(),
    custom_cost_ngn: z.coerce.number().nonnegative().optional(),
  })
  .strict();

const sliderItem = z.object({
  slider_key: z.string().min(1).max(60),
  baseline_value: z.coerce.number(),
  scenario_value: z.coerce.number(),
  notes: z.string().max(500).optional(),
});
const computeBody = z
  .object({ sliders: z.array(sliderItem).optional() })
  .strict();

const proposalCreate = z
  .object({
    scenario_id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    effective_from: z.string().date().optional(),
    effective_to: z.string().date().optional(),
  })
  .strict();

const reasonBody = z
  .object({ reason: z.string().max(1000).optional() })
  .strict();

const mk = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body || {});
  next();
};

module.exports = {
  validateRuleCreate: mk(ruleCreate),
  validateRuleUpdate: mk(ruleUpdate),
  validateFloorSet: mk(floorSet),
  validateOverrideSet: mk(overrideSet),
  validateScenarioCreate: mk(scenarioCreate),
  validateCompute: mk(computeBody),
  validateProposalCreate: mk(proposalCreate),
  validateReason: mk(reasonBody),
};
