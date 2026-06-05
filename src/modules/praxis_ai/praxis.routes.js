/**
 * Praxis AI Agent (V2.2 §6.29)
 *
 * Module: praxis_ai
 * Permission key: praxis_ai
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   ai_conversations, ai_messages, ai_run_steps, ai_pending_actions, action_catalogue
 */

"use strict";

const express = require("express");
const controller = require("./praxis.controller");
const validator = require("./praxis.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("praxis_ai", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("praxis_ai", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("praxis_ai", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("praxis_ai", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("praxis_ai", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
