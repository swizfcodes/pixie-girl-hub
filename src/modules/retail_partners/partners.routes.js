/**
 * Wholesale Retail Partners + Consignment
 *
 * Module: retail_partners
 * Permission key: retail_partners
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   retail_partners, consignment_locations, consignment_stock, consignment_movements, partner_settlements, partner_settlement_lines
 */

"use strict";

const express = require("express");
const controller = require("./partners.controller");
const validator = require("./partners.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("retail_partners", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("retail_partners", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("retail_partners", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("retail_partners", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("retail_partners", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
