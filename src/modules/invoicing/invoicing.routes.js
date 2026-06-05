/**
 * Invoicing & Billing (V2.2 §6.5)
 *
 * Module: invoicing
 * Permission key: invoicing
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   invoices, invoice_lines, invoice_payments, credit_notes, receipts, invoice_reminders
 */

"use strict";

const express = require("express");
const controller = require("./invoicing.controller");
const validator = require("./invoicing.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("invoicing", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("invoicing", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("invoicing", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("invoicing", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("invoicing", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
