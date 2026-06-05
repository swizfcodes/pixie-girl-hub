/**
 * AI Insights & Briefings (V2.2 §6.30)
 *
 * Module: ai_insights
 * Permission key: ai_insights
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   ai_insight_stock_alerts, ai_insight_margin_breaches, ai_insight_invoice_alerts, ai_insight_intercompany_alerts, ai_insight_attendance_anomalies, ai_insight_approval_queue_alerts, ai_insight_service_match, ai_briefings
 */

"use strict";

const express = require("express");
const controller = require("./insights.controller");
const validator = require("./insights.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("ai_insights", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("ai_insights", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("ai_insights", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("ai_insights", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("ai_insights", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
