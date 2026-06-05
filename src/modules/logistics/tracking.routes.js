/**
 * Public order tracking (V2.2 §6.23.6).
 * Lookup by public_tracking_token. No auth required.
 * GET /api/public/tracking/:token
 */

"use strict";

const express = require("express");
const router = express.Router();

router.get("/:token", (req, res) =>
  res.json({ data: { token: req.params.token, events: [] } }),
);

module.exports = router;
