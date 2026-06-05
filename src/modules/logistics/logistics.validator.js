/**
 * Logistics & Delivery (V2.2 §6.10)
 * Input validators — Zod schemas wrapped in Express middleware.
 */

"use strict";

const { z } = require("zod");

const createSchema = z.object({
  // TODO: define required fields for create
});

const updateSchema = createSchema.partial();

function validateCreate(req, _res, next) {
  req.body = createSchema.parse(req.body);
  next();
}

function validateUpdate(req, _res, next) {
  req.body = updateSchema.parse(req.body);
  next();
}

module.exports = { validateCreate, validateUpdate, createSchema, updateSchema };
