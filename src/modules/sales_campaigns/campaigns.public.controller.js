/**
 * Sales Campaigns — PUBLIC controller (no auth).
 * Brand hint comes from the X-Brand-Context header or ?brand query, else
 * the service scans brands by slug.
 */

"use strict";

const publicService = require("./campaigns.public.service");

function brandHint(req) {
  const h = req.headers["x-brand-context"] || req.query.brand;
  return typeof h === "string" ? h.toLowerCase().trim() : undefined;
}

async function landing(req, res) {
  const data = await publicService.getLanding({
    slug: req.params.slug,
    brandHint: brandHint(req),
  });
  res.json({ data });
}

async function stock(req, res) {
  const data = await publicService.getStock({
    slug: req.params.slug,
    brandHint: brandHint(req),
  });
  res.json({ data });
}

async function signup(req, res) {
  const result = await publicService.signup({
    slug: req.params.slug,
    brandHint: brandHint(req),
    input: req.body,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
  });
  res.status(result.already_signed_up ? 200 : 201).json({ data: result });
}

module.exports = { landing, stock, signup };
