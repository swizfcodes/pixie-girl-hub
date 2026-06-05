/**
 * Faitlyn Service Job Tracker (V2.2 §6.24)
 *
 * Module: service_jobs
 * Permission key: service_jobs
 *
 * Backing tables (per-brand or shared as documented in schema):
 *   service_types, service_jobs
 */

"use strict";

const express = require("express");
const controller = require("./service-jobs.controller");
const validator = require("./service-jobs.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// ── GET /             list ─────────────────────────────────
router.get("/", requirePermission("service_jobs", "view"), controller.list);

// ── GET /:id          detail ───────────────────────────────
router.get(
  "/:id",
  requirePermission("service_jobs", "view"),
  controller.getById,
);

// ── POST /            create ───────────────────────────────
router.post(
  "/",
  requirePermission("service_jobs", "create"),
  validator.validateCreate,
  controller.create,
);

// ── PATCH /:id        update ───────────────────────────────
router.patch(
  "/:id",
  requirePermission("service_jobs", "edit"),
  validator.validateUpdate,
  controller.update,
);

// ── DELETE /:id       archive/soft-delete ──────────────────
router.delete(
  "/:id",
  requirePermission("service_jobs", "delete"),
  controller.archive,
);

// TODO: module-specific endpoints (state transitions, sub-resources, etc.)

module.exports = router;
