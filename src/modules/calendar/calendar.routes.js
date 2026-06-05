/**
 * Calendar & Scheduling (V2.2 §6.18)
 *
 * Module: calendar
 * Permission key: calendar
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   calendar_events, calendar_event_participants, calendar_resources
 */

"use strict";

const express = require("express");
const controller = require("./calendar.controller");
const validator = require("./calendar.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("calendar", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get("/:id", requirePermission("calendar", "view"), controller.getById);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("calendar", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("calendar", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("calendar", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
