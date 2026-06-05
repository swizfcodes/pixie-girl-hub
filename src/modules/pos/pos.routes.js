/**
 * Point of Sale (V2.2 §6.3)
 *
 * Module: pos
 * Permission key: pos
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   pos_terminals, pos_sessions, pos_transactions, pos_transaction_splits, pos_cash_drops, pos_void_log
 */

"use strict";

const express = require("express");
const controller = require("./pos.controller");
const validator = require("./pos.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("pos", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("pos", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("pos", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("pos", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete("/:id", requirePermission("pos", "delete"), controller.archive);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
