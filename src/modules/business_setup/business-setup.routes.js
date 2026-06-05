/**
 * Business Setup (V2.2 §6.21)
 *
 * Module: business_setup
 * Permission key: business_setup
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   business_config, currencies, fx_rates, tax_rates, document_numbering, webhook_log
 */

"use strict";

const express = require("express");
const controller = require("./business-setup.controller");
const validator = require("./business-setup.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("business_setup", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("business_setup", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("business_setup", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("business_setup", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("business_setup", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
