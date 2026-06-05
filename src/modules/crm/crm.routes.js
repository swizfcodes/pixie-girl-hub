/**
 * Customer Management (V2.2 §6.1)
 *
 * Module: crm
 * Permission key: crm
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   crm_pipelines, crm_pipeline_stages, crm_deals, crm_activities, crm_notes, customer_preferences, customer_measurements, churn_risk_scores
 */

"use strict";

const express = require("express");
const controller = require("./crm.controller");
const validator = require("./crm.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("crm", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("crm", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("crm", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("crm", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete("/:id", requirePermission("crm", "delete"), controller.archive);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
