/**
 * Accounting & Finance (V2.2 §6.6)
 *
 * Module: accounting
 * Permission key: accounting
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   chart_of_accounts, journal_entries, journal_lines, fiscal_periods, bank_statements, bank_reconciliations, tax_filings
 */

"use strict";

const express = require("express");
const controller = require("./accounting.controller");
const validator = require("./accounting.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("accounting", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("accounting", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("accounting", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("accounting", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("accounting", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
