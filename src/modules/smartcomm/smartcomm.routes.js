/**
 * Messaging Smartcomm (V2.2 §6.17) — routes. Mounted at /api/v1/smartcomm.
 * Permission key: smartcomm. Internal channels + customer threads + outbound
 * dispatch (WhatsApp/email). The shared `messaging` tables are owned here.
 */

"use strict";

const express = require("express");
const controller = require("./smartcomm.controller");
const validator = require("./smartcomm.validator");
const { requirePermission } = require("../../middleware/rbac");

// Side-effect: register order.payment_reminder → customer dispatch (G-4).
require("./smartcomm.subscribers");

const router = express.Router();
const can = (action) => requirePermission("smartcomm", action);

router.get("/channels", can("view"), controller.listChannels);
router.get("/channels/:id", can("view"), controller.getChannel);
router.post(
  "/channels/:id/messages",
  can("edit"),
  validator.validatePostMessage,
  controller.postMessage,
);
router.post(
  "/send",
  can("edit"),
  validator.validateSendToCustomer,
  controller.sendToCustomer,
);

module.exports = router;
