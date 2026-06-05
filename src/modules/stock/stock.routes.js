/**
 * Stock SSOT (V2.2 §6.9)
 *
 * Module: stock
 * Permission key: stock
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   stock_locations, stock_movements, stock_levels, stock_alerts, stock_adjustments, stock_transfers, inbound_shipments
 */

"use strict";

const express = require("express");
const controller = require("./stock.controller");
const validator = require("./stock.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("stock", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("stock", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("stock", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("stock", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete("/:id", requirePermission("stock", "delete"), controller.archive);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
