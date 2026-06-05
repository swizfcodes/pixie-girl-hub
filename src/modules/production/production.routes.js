/**
 * Production & Landed Cost (V2.2 §6.24)
 *
 * Module: production
 * Permission key: production
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   production_runs, production_run_units, cost_components, landed_cost_breakdown, chemical_recipes, monthly_chemical_reconciliations, funding_sources
 */

"use strict";

const express = require("express");
const controller = require("./production.controller");
const validator = require("./production.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("production", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("production", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("production", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("production", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("production", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
