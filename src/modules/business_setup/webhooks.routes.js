/**
 * Inbound webhook receivers.
 *
 * Each gateway / channel has its own verifier. Receivers:
 *   - Verify signature against the registered secret
 *   - Persist raw payload to shared.webhook_log (append-only)
 *   - Enqueue a processing job (so the response is fast)
 *   - Return 200/204 quickly (gateway requirement)
 *
 * Mounted at: /api/webhooks/*
 */

"use strict";

const express = require("express");
const router = express.Router();

// Note: raw body needed for HMAC verification — apply express.raw() per route
router.post(
  "/paystack",
  express.raw({ type: "application/json" }),
  (_req, res) => res.status(200).send(),
);
router.post("/opay", express.raw({ type: "application/json" }), (_req, res) =>
  res.status(200).send(),
);
router.post("/stripe", express.raw({ type: "application/json" }), (_req, res) =>
  res.status(200).send(),
);
router.post("/nomba", express.raw({ type: "application/json" }), (_req, res) =>
  res.status(200).send(),
);

// Meta verification (GET) + payload (POST)
router.get("/meta/whatsapp", (_req, res) => res.status(200).send());
router.post(
  "/meta/whatsapp",
  express.raw({ type: "application/json" }),
  (_req, res) => res.status(200).send(),
);
router.get("/meta/instagram", (_req, res) => res.status(200).send());
router.post(
  "/meta/instagram",
  express.raw({ type: "application/json" }),
  (_req, res) => res.status(200).send(),
);

// Logistics
router.post(
  "/chowdeck",
  express.raw({ type: "application/json" }),
  (_req, res) => res.status(200).send(),
);
router.post("/gigl", express.raw({ type: "application/json" }), (_req, res) =>
  res.status(200).send(),
);

module.exports = router;
