/**
 * Storefront Studio (V2.2 §6.28)
 *
 * Module: storefront_studio
 * Permission key: storefront_studio
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   storefront_themes, storefront_pages, storefront_navigation, storefront_revisions
 */

"use strict";

const express = require("express");
const controller = require("./studio.controller");
const validator = require("./studio.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get(
  "/",
  requirePermission("storefront_studio", "view"),
  controller.list,
);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("storefront_studio", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("storefront_studio", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("storefront_studio", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("storefront_studio", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
