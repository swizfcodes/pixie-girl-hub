/**
 * Logistics & Delivery (V2.2 §6.10)
 *
 * Module: logistics
 * Permission key: logistics
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   couriers, deliveries, delivery_attempts, delivery_proofs, pay_on_delivery_collections
 */

"use strict";

const express = require("express");
const controller = require("./logistics.controller");
const validator = require("./logistics.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("logistics", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("logistics", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("logistics", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("logistics", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("logistics", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
