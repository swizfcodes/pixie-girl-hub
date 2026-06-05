/**
 * Pricing Engine (V2.2 §6.25)
 *
 * Module: pricing
 * Permission key: pricing
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   pricing_rules, pricing_floors, cost_pass_through_rules, channel_price_overrides, price_proposals, price_history
 */

"use strict";

const express = require("express");
const controller = require("./pricing.controller");
const validator = require("./pricing.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("pricing", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("pricing", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("pricing", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("pricing", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("pricing", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
