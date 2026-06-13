/**
 * Audit log read-access (V2.2 §3 — append-only)
 * Input validators — Zod schemas wrapped in Express middleware.
 */

"use strict";

const { z } = require("zod");

// The audit log is APPEND-ONLY and SYSTEM-WRITTEN — entries are produced by the
// audit() middleware/service, never from a client body. `audit.routes` exposes
// GET endpoints only, so there is no create/update body to validate. What IS
// user-supplied is the list filter, validated here.

/** Query filters for GET /audit (list). `.passthrough()` keeps any extra params. */
const listQuerySchema = z
  .object({
    table_name: z.string().max(120).optional(),
    record_id: z.string().max(120).optional(),
    actor_user_id: z.string().uuid().optional(),
    action_key: z.string().max(120).optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .passthrough();

function validateListQuery(req, _res, next) {
  req.query = listQuerySchema.parse(req.query);
  next();
}

module.exports = { listQuerySchema, validateListQuery };
