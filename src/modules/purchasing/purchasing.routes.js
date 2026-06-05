/**
 * Purchasing & Imports (V2.2 §6.8)
 *
 * Module: purchasing
 * Permission key: purchasing
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   suppliers, supplier_contacts, rfqs, purchase_orders, goods_received_notes, supplier_invoices
 */

"use strict";

const express = require("express");
const controller = require("./purchasing.controller");
const validator = require("./purchasing.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("purchasing", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("purchasing", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("purchasing", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("purchasing", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("purchasing", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
