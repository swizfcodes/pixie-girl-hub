/**
 * Email Campaigns (V2.2 §6.16)
 *
 * Module: email_campaigns
 * Permission key: email_campaigns
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   email_templates, email_milestone_rules, email_campaigns, email_campaign_variants, email_campaign_recipients, email_campaign_events
 */

"use strict";

const express = require("express");
const controller = require("./email-campaigns.controller");
const validator = require("./email-campaigns.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("email_campaigns", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("email_campaigns", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("email_campaigns", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("email_campaigns", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("email_campaigns", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
