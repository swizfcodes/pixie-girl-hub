/**
 * Notifications (V2.2) — routes. Mounted at /api/v1/notifications. Personal
 * feed for the authenticated user (auth applied upstream; no module
 * permission — a user only sees their own notifications).
 */

"use strict";

const express = require("express");
const controller = require("./notifications.controller");

// Side-effect: register domain-event → notification fan-out.
require("./notifications.subscribers");

const router = express.Router();

router.get("/", controller.list);
router.get("/unread-count", controller.unreadCount);
router.post("/:id/read", controller.markRead);
router.post("/read-all", controller.markAllRead);

module.exports = router;
