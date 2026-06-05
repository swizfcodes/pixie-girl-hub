/**
 * Sales Campaigns & Landing Pages (V2.2 §6.22)
 *
 * Module: sales_campaigns
 * Permission key: sales_campaigns
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   sales_campaigns, sales_campaign_products, sales_campaign_signups
 */

"use strict";

const express = require("express");
const controller = require("./campaigns.controller");
const validator = require("./campaigns.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("sales_campaigns", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("sales_campaigns", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("sales_campaigns", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("sales_campaigns", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("sales_campaigns", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
