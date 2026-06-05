/**
 * E-Commerce Storefront & Channel Sync (V2.2 §6.4)
 *
 * Module: storefront
 * Permission key: storefront
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   storefront_pages, storefront_themes, storefront_content_posts, carts, product_videos
 */

"use strict";

const express = require("express");
const controller = require("./storefront.controller");
const validator = require("./storefront.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("storefront", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("storefront", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("storefront", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("storefront", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("storefront", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
