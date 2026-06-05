/**
 * Hair Quiz public endpoints (V2.2 §6.23 — "Find your style").
 * GET  /api/public/hair-quiz                — get quiz schema
 * POST /api/public/hair-quiz/submit         — submit answers, get product recs + create CRM lead + award Streak Stars
 */

"use strict";

const express = require("express");
const router = express.Router();

router.get("/", (_req, res) => res.json({ data: { questions: [] } }));
router.post("/submit", (_req, res) =>
  res.status(501).json({ error: { code: "NOT_IMPLEMENTED" } }),
);

module.exports = router;
