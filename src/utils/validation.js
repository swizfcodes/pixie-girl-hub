/**
 * Shared validation primitives — reusable Zod schemas.
 */

"use strict";

const { z } = require("zod");

const uuid = z.string().uuid();
const email = z.string().email().max(255);
const phone = z.string().min(7).max(20);
const ngnAmount = z.coerce.number().nonnegative().multipleOf(0.01);
const currencyCode = z.enum(["NGN", "USD", "GBP", "EUR", "CAD", "GHS"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

module.exports = { uuid, email, phone, ngnAmount, currencyCode, isoDate };
