/**
 * Sales & Quotations + Installment Payments (V2.2 §6.2)
 *
 * Module: sales
 * Permission key: sales
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   sales_orders, sales_order_lines, sales_order_payments, quotations, cancellation_requests
 */

"use strict";

const express = require("express");
const controller = require("./sales.controller");
const validator = require("./sales.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("sales", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("sales", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("sales", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("sales", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete("/:id", requirePermission("sales", "delete"), controller.archive);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
