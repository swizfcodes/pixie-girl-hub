/**
 * AI Control & Governance (V2.2 §6.31)
 *
 * Module: ai_governance
 * Permission key: ai_governance
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   ai_feature_flags, ai_vendor_credentials, ai_access_grants, ai_budget_periods, ai_usage_ledger, ai_usage_daily, ai_knowledge_chunks
 */

"use strict";

const express = require("express");
const controller = require("./governance.controller");
const validator = require("./governance.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("ai_governance", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("ai_governance", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("ai_governance", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("ai_governance", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("ai_governance", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
