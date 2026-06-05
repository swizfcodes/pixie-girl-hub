/**
 * Install QR Hub (V2.2 §6.10 — Curated Delivery Letter).
 * Public hub resolved via public_tracking_token.
 * GET /api/public/install-hub/:token
 */

"use strict";

const express = require("express");
const router = express.Router();

router.get("/:token", (req, res) =>
  res.json({ data: { token: req.params.token } }),
);

module.exports = router;
