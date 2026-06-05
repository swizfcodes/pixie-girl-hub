/**
 * Cash Request & Disbursement (V2.2 §6.32 — NEW MODULE — pending schema)
 *
 * Module: cash_request
 * Permission key: expenses
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   cash_requests (PENDING), cash_request_state_history (PENDING)
 */

"use strict";

const express = require("express");
const controller = require("./cash-request.controller");
const validator = require("./cash-request.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("expenses", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("expenses", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("expenses", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("expenses", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("expenses", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
