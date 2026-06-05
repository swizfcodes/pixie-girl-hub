/**
 * Dashboards & Reports (V2.2 §6.20 + §6.30 weekly reports)
 *
 * Module: dashboards
 * Permission key: dashboards
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   dashboard_configs, dashboard_widgets, saved_reports, report_templates, report_runs, report_run_outputs
 */

"use strict";

const express = require("express");
const controller = require("./dashboards.controller");
const validator = require("./dashboards.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("dashboards", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("dashboards", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("dashboards", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("dashboards", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("dashboards", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
