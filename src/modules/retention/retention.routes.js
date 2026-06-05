/**
 * Customer Retention & Loyalty + Streak Stars + Hair Quiz (V2.2 §6.23)
 *
 * Module: retention
 * Permission key: retention
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   loyalty_tiers, loyalty_ledger, customer_loyalty_state, coupons, subscription_plans, subscriptions, bundle_offers, maintenance_plans, maintenance_subscriptions, retention_workflow_rules, retention_workflow_executions, referral_codes, referral_redemptions
 */

"use strict";

const express = require("express");
const controller = require("./retention.controller");
const validator = require("./retention.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("retention", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("retention", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("retention", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("retention", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("retention", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
