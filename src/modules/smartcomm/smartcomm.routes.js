/**
 * Messaging Smartcomm (V2.2 §6.17)
 *
 * Module: smartcomm
 * Permission key: smartcomm
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   comms_threads, comms_messages
 */

"use strict";

const express = require("express");
const controller = require("./smartcomm.controller");
const validator = require("./smartcomm.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("smartcomm", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("smartcomm", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("smartcomm", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("smartcomm", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("smartcomm", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
