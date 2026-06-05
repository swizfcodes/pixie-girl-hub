/**
 * Sales Campaigns & Landing Pages (V2.2 §6.22)
 *
 * Module: sales_campaigns   Permission key: sales_campaigns
 * Mounted at /api/v1/sales-campaigns (auth + brand-context applied upstream).
 *
 * Backing tables: sales_campaigns, sales_campaign_products,
 *                 sales_campaign_signups, sales_campaign_metrics
 */

"use strict";

const express = require("express");
const controller = require("./campaigns.controller");
const validator = require("./campaigns.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── Collection ─────────────────────────────────────────────
router.get("/", requirePermission("sales_campaigns", "view"), controller.list);
router.post(
  "/",
  requirePermission("sales_campaigns", "create"),
  validator.validateCreate,
  controller.create,
);

// ── Single campaign ────────────────────────────────────────
router.get("/:id", requirePermission("sales_campaigns", "view"), controller.getById);
router.patch(
  "/:id",
  requirePermission("sales_campaigns", "edit"),
  validator.validateUpdate,
  controller.update,
);
router.delete("/:id", requirePermission("sales_campaigns", "delete"), controller.archive);

// ── Lifecycle transitions ──────────────────────────────────
router.post(
  "/:id/submit",
  requirePermission("sales_campaigns", "edit"),
  validator.validateTransition,
  controller.submit,
);
router.post(
  "/:id/approve",
  requirePermission("sales_campaigns", "approve"),
  validator.validateTransition,
  controller.approve,
);
router.post(
  "/:id/reject",
  requirePermission("sales_campaigns", "approve"),
  validator.validateTransition,
  controller.reject,
);
router.post("/:id/launch", requirePermission("sales_campaigns", "edit"), controller.launch);
router.post("/:id/pause", requirePermission("sales_campaigns", "edit"), controller.pause);
router.post("/:id/resume", requirePermission("sales_campaigns", "edit"), controller.resume);
router.post("/:id/end", requirePermission("sales_campaigns", "edit"), controller.end);
router.post(
  "/:id/duplicate",
  requirePermission("sales_campaigns", "create"),
  validator.validateDuplicate,
  controller.duplicate,
);

// ── Products (include / exclude) ───────────────────────────
router.get(
  "/:id/products",
  requirePermission("sales_campaigns", "view"),
  controller.listProducts,
);
router.post(
  "/:id/products",
  requirePermission("sales_campaigns", "edit"),
  validator.validateAddProduct,
  controller.addProduct,
);
router.patch(
  "/:id/products/:linkId",
  requirePermission("sales_campaigns", "edit"),
  validator.validateUpdateProduct,
  controller.updateProduct,
);
router.delete(
  "/:id/products/:linkId",
  requirePermission("sales_campaigns", "edit"),
  controller.removeProduct,
);

// ── Landing page ───────────────────────────────────────────
router.get(
  "/:id/landing",
  requirePermission("sales_campaigns", "view"),
  controller.getLanding,
);
router.patch(
  "/:id/landing",
  requirePermission("sales_campaigns", "edit"),
  validator.validateLanding,
  controller.updateLanding,
);
router.get(
  "/:id/preview",
  requirePermission("sales_campaigns", "view"),
  controller.preview,
);
router.get(
  "/:id/share-kit",
  requirePermission("sales_campaigns", "view"),
  controller.shareKit,
);

// ── Signups & analytics ────────────────────────────────────
router.get(
  "/:id/signups",
  requirePermission("sales_campaigns", "view"),
  controller.listSignups,
);
router.get(
  "/:id/metrics",
  requirePermission("sales_campaigns", "view"),
  controller.metrics,
);
router.get(
  "/:id/metrics/daily",
  requirePermission("sales_campaigns", "view"),
  controller.dailyMetrics,
);
router.get(
  "/:id/report",
  requirePermission("sales_campaigns", "view"),
  controller.report,
);

module.exports = router;
