/**
 * Public Order Form (V2.2 §6.4 page 575).
 * No-login checkout at pixiegirlglobal.com/order
 * POST /api/public/order-form
 */

"use strict";

const express = require("express");
const router = express.Router();

router.post("/", (_req, res) =>
  res.status(501).json({ error: { code: "NOT_IMPLEMENTED" } }),
);

module.exports = router;
