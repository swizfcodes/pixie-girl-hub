/**
 * Inter-Company Transactions (V2.2 §5.1)
 *
 * Module: intercompany
 * Permission key: intercompany
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   intercompany_transactions, intercompany_reconciliations, intercompany_settings
 */

"use strict";

const express = require("express");
const controller = require("./intercompany.controller");
const validator = require("./intercompany.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("intercompany", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("intercompany", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("intercompany", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("intercompany", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("intercompany", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
