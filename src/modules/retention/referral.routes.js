/**
 * Public referral landing (V2.2 §6.23.1).
 * pixiegirlglobal.ng/ref/:code → set cookie, redirect to storefront
 * GET /api/public/referral/:code
 */

"use strict";

const express = require("express");
const router = express.Router();

router.get("/:code", (req, res) =>
  res.json({ data: { code: req.params.code, valid: false } }),
);

module.exports = router;
