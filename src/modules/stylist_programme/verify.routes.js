/**
 * Public stylist badge verification (V2.2 §6.26).
 * Resolves at style.pixiegirlglobal.com/verify/:badge_id
 * GET /api/public/stylist-verify/:badge_id
 */

"use strict";

const express = require("express");
const router = express.Router();

router.get("/:badge_id", (req, res) =>
  res.json({ data: { badge_id: req.params.badge_id, status: "unknown" } }),
);

module.exports = router;
