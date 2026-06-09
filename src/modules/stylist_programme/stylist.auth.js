/**
 * Stylist portal auth middleware (V2.2 §6.26).
 *
 * Stylists are external partners, NOT staff — they get their own JWT class
 * (`type: 'stylist'`, subject = stylist_id). This middleware verifies that
 * token and attaches req.stylist. It deliberately rejects staff tokens so a
 * misrouted staff JWT can never act on a stylist-portal endpoint.
 */

"use strict";

const jwt = require("jsonwebtoken");
const { config } = require("../../config/env");
const { AppError } = require("../../utils/errors");
const repo = require("./stylist.repo");

async function stylistAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    throw new AppError("AUTH_REQUIRED", "Authorization header missing", 401);

  const token = header.slice("Bearer ".length).trim();
  let payload;
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError")
      throw new AppError("TOKEN_EXPIRED", "Access token expired", 401);
    throw new AppError("INVALID_TOKEN", "Invalid access token", 401);
  }
  if (payload.type !== "stylist")
    throw new AppError("WRONG_TOKEN_TYPE", "Not a stylist token", 401);

  const partner = await repo.findPartner({ id: payload.sub });
  if (!partner || partner.status === "terminated")
    throw new AppError("INACTIVE", "Stylist account not active", 401);

  req.stylist = {
    stylist_id: partner.stylist_id,
    partner_code: partner.partner_code,
    status: partner.status,
  };
  return next();
}

module.exports = { stylistAuth };
