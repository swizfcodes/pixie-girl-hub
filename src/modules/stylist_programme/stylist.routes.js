/**
 * Stylist Partner Programme (V2.2 §6.26)
 *
 * Module: stylist_programme
 * Permission key: stylist_programme
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   stylist_partners, stylist_specialities, stylist_certifications, stylist_assignments, stylist_payouts
 */

"use strict";

const express = require("express");
const controller = require("./stylist.controller");
const validator = require("./stylist.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get(
  "/",
  requirePermission("stylist_programme", "view"),
  controller.list,
);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("stylist_programme", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("stylist_programme", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("stylist_programme", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("stylist_programme", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
