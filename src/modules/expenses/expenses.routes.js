/**
 * Expense Management (V2.2 §6.7)
 *
 * Module: expenses
 * Permission key: expenses
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   expenses, expense_lines, expense_categories, cash_advances
 */

"use strict";

const express = require("express");
const controller = require("./expenses.controller");
const validator = require("./expenses.validator");
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
