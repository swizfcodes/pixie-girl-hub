/**
 * Authentication routes — login, refresh, logout, password reset, MFA.
 * No JWT required to call these (login is how you get the JWT).
 *
 * POST /api/v1/auth/login
 * POST /api/v1/auth/refresh
 * POST /api/v1/auth/logout
 * POST /api/v1/auth/forgot-password
 * POST /api/v1/auth/reset-password
 * POST /api/v1/auth/change-password   (requires auth)
 */

"use strict";

const express = require("express");
const controller = require("./auth.controller");

const router = express.Router();

router.post("/login", controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.post("/forgot-password", controller.forgotPassword);
router.post("/reset-password", controller.resetPassword);

module.exports = router;
