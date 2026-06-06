/**
 * Sales Campaigns — PUBLIC routes (no auth).
 * Mounted at /api/public/sale.
 *
 *   GET  /:slug          → landing payload (before | live | ended)
 *   GET  /:slug/stock    → live stock counters (poll fallback for socket)
 *   POST /:slug/signup   → pre-launch notification signup (rate-limited)
 */

"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const controller = require("./campaigns.public.controller");
const validator = require("./campaigns.validator");

const router = express.Router();

// Reads are cheap; cap abuse on the public signup.
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many signups, try again later",
    },
  },
});

router.get("/:slug", controller.landing);
router.get("/:slug/stock", controller.stock);
router.post(
  "/:slug/signup",
  signupLimiter,
  validator.validateSignup,
  controller.signup,
);

module.exports = router;
