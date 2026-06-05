/**
 * Organisation & Workflow Builder (V2.2 §6.27)
 *
 * Module: org_workflow
 * Permission key: org_workflow
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   org_units, org_positions, org_position_dotted_lines, roles, permissions, workflow_definitions, workflow_instances, workflow_step_history
 */

"use strict";

const express = require("express");
const controller = require("./org.controller");
const validator = require("./org.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("org_workflow", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("org_workflow", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("org_workflow", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("org_workflow", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("org_workflow", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
