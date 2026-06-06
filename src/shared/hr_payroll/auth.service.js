/**
 * Auth service — login / refresh / logout business logic.
 * See auth.controller.js for the HTTP contract.
 */

"use strict";

const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const { v4: uuidv4 } = require("uuid");
const { config } = require("../../config/env");
const { AppError } = require("../../utils/errors");
const { getClient: getRedis } = require("../../config/redis");
const staffRepo = require("./staff.repo");

async function login({ email, password, ip, user_agent }) {
  if (!email || !password)
    throw new AppError(
      "INVALID_CREDENTIALS",
      "Email and password required",
      400,
    );
  const user = await staffRepo.findByEmail(email.toLowerCase());
  if (!user)
    throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
  if (user.status === "locked")
    throw new AppError(
      "USER_LOCKED",
      "Account locked. Contact administrator",
      423,
    );
  if (user.status !== "active")
    throw new AppError("USER_INACTIVE", "Account not active", 401);

  const ok = await argon2.verify(user.password_hash, password);
  if (!ok) {
    await staffRepo.recordFailedLogin(user.user_id);
    throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
  }
  await staffRepo.recordSuccessfulLogin(user.user_id, { ip, user_agent });

  const access_jti = uuidv4();
  const refresh_jti = uuidv4();
  const payload = { sub: user.user_id, jti: access_jti, email: user.email };

  const access_token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  });
  const refresh_token = jwt.sign(
    { sub: user.user_id, jti: refresh_jti, type: "refresh" },
    config.JWT_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN },
  );

  // Store refresh jti in redis so it's revocable
  const redis = getRedis();
  await redis.set(
    `refresh:${refresh_jti}`,
    user.user_id,
    "EX",
    14 * 24 * 60 * 60,
  );

  return {
    user: {
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      is_ceo: user.is_ceo,
      available_businesses: user.available_businesses || [],
      default_business_key: user.default_business_key || null,
    },
    access_token,
    refresh_token,
    expires_in: 15 * 60,
  };
}

async function refresh({ refresh_token }) {
  if (!refresh_token)
    throw new AppError("NO_REFRESH_TOKEN", "Refresh token missing", 401);
  let payload;
  try {
    payload = jwt.verify(refresh_token, config.JWT_SECRET);
  } catch {
    throw new AppError("INVALID_TOKEN", "Refresh token invalid", 401);
  }
  if (payload.type !== "refresh")
    throw new AppError("INVALID_TOKEN", "Not a refresh token", 401);

  const redis = getRedis();
  const stored = await redis.get(`refresh:${payload.jti}`);
  if (!stored || stored !== payload.sub) {
    throw new AppError("TOKEN_REVOKED", "Refresh token revoked", 401);
  }

  // Rotate: revoke old, issue new
  await redis.del(`refresh:${payload.jti}`);
  const new_refresh_jti = uuidv4();
  const new_access_jti = uuidv4();
  const access_token = jwt.sign(
    { sub: payload.sub, jti: new_access_jti },
    config.JWT_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES_IN },
  );
  const new_refresh_token = jwt.sign(
    { sub: payload.sub, jti: new_refresh_jti, type: "refresh" },
    config.JWT_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN },
  );
  await redis.set(
    `refresh:${new_refresh_jti}`,
    payload.sub,
    "EX",
    14 * 24 * 60 * 60,
  );

  return {
    access_token,
    refresh_token: new_refresh_token,
    expires_in: 15 * 60,
  };
}

async function logout({ refresh_token }) {
  if (!refresh_token) return;
  try {
    const payload = jwt.verify(refresh_token, config.JWT_SECRET);
    const redis = getRedis();
    await redis.del(`refresh:${payload.jti}`);
  } catch {
    // ignore — already invalid
  }
}

async function forgotPassword({ email }) {
  // TODO: generate token, store in redis with TTL, send reset email
  // Always returns 200 to avoid leaking which emails exist
}

async function resetPassword({ token, new_password }) {
  // TODO: verify token from redis, hash new password (argon2), update user, revoke all sessions
}

module.exports = { login, refresh, logout, forgotPassword, resetPassword };
