/**
 * Auth controller — issues + refreshes JWTs.
 *
 * Login flow:
 *   1. Validate email + password (argon2 verify)
 *   2. Check user is active, not locked
 *   3. Increment failed_login_count on bad password; lock at 5
 *   4. Issue access_token (15m) + refresh_token (14d) — refresh stored in
 *      redis keyed by jti so it can be revoked
 *   5. Set httpOnly refresh cookie; return access token in body
 */

"use strict";

const service = require("./auth.service");

async function login(req, res) {
  const { email, password } = req.body || {};
  const result = await service.login({
    email,
    password,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
  });
  res.cookie("refresh_token", result.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
  res.json({
    data: {
      user: result.user,
      access_token: result.access_token,
      expires_in: result.expires_in,
    },
  });
}

async function refresh(req, res) {
  const token = req.cookies?.refresh_token;
  const result = await service.refresh({ refresh_token: token });
  res.cookie("refresh_token", result.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
  res.json({
    data: { access_token: result.access_token, expires_in: result.expires_in },
  });
}

async function logout(req, res) {
  const token = req.cookies?.refresh_token;
  await service.logout({ refresh_token: token });
  res.clearCookie("refresh_token");
  res.status(204).end();
}

async function forgotPassword(req, res) {
  await service.forgotPassword({ email: req.body?.email });
  // Always 200 — don't leak whether email exists
  res.json({ data: { sent: true } });
}

async function resetPassword(req, res) {
  await service.resetPassword({
    token: req.body?.token,
    new_password: req.body?.new_password,
  });
  res.json({ data: { ok: true } });
}

module.exports = { login, refresh, logout, forgotPassword, resetPassword };
