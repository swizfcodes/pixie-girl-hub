/**
 * Marketing Campaigns & Ad Analytics (V2.2 §6.15)
 *
 * Module: marketing
 * Permission key: ad_analytics
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   ad_accounts, ad_campaigns
 */

"use strict";

const express = require("express");
const controller = require("./marketing.controller");
const validator = require("./marketing.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("ad_analytics", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("ad_analytics", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("ad_analytics", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("ad_analytics", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("ad_analytics", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
