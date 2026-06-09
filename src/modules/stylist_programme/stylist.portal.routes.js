/**
 * Stylist Partner Programme (V2.2 §6.26) — PORTAL routes for partners.
 * Mounted at /api/v1/stylist-portal. Uses the stylist JWT class (NOT staff
 * auth). `login` is unauthenticated; everything else requires stylistAuth.
 */

"use strict";

const express = require("express");
const c = require("./stylist.controller");
const v = require("./stylist.validator");
const { stylistAuth } = require("./stylist.auth");

const router = express.Router();

// Unauthenticated: issues the stylist token.
router.post("/login", v.validateLogin, c.login);

// Authenticated portal surface.
router.get("/me", stylistAuth, c.myProfile);
router.get("/offers", stylistAuth, c.myOffers);
router.get("/assignments", stylistAuth, c.myAssignments);
router.get("/payouts", stylistAuth, c.myPayouts);

router.post("/assignments/:id/accept", stylistAuth, c.acceptOffer);
router.post(
  "/assignments/:id/decline",
  stylistAuth,
  v.validateReason,
  c.declineOffer,
);
router.post("/assignments/:id/start", stylistAuth, c.startAssignment);
router.post("/assignments/:id/complete", stylistAuth, c.completeAssignment);

module.exports = router;
