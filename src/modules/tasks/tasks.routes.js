/**
 * Tasks & To-Do (V2.2 §6.19)
 *
 * Module: tasks
 * Permission key: tasks
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   tasks, task_subtasks
 */

"use strict";

const express = require("express");
const controller = require("./tasks.controller");
const validator = require("./tasks.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("tasks", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("tasks", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("tasks", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("tasks", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete("/:id", requirePermission("tasks", "delete"), controller.archive);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
