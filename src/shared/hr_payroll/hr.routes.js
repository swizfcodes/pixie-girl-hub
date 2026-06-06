/**
 * HR & Payroll routes (V2.2 §6.11).
 * Staff CRUD, leave, performance, commissions, payroll runs, payslips.
 *
 * Sub-resources:
 *   /staff
 *   /leave
 *   /performance/cycles
 *   /performance/scores
 *   /commission-rules
 *   /commission-earned
 *   /bonus-rules
 *   /bonuses
 *   /payroll/runs
 *   /payslips
 */

"use strict";

const express = require("express");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();

// Top-level list = staff directory by default
router.get("/staff", requirePermission("hr_payroll", "view"), (_req, res) =>
  res.json({ data: [] }),
);
router.get("/leave", requirePermission("hr_payroll", "view"), (_req, res) =>
  res.json({ data: [] }),
);
router.get(
  "/performance/cycles",
  requirePermission("hr_payroll", "view"),
  (_req, res) => res.json({ data: [] }),
);
router.get(
  "/payroll/runs",
  requirePermission("hr_payroll", "view"),
  (_req, res) => res.json({ data: [] }),
);
router.get("/payslips", requirePermission("hr_payroll", "view"), (_req, res) =>
  res.json({ data: [] }),
);

module.exports = router;
