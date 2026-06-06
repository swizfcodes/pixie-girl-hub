/**
 * Identity & Access Administration validators (Zod).
 * Module/action/scope values are checked against the catalog in the service
 * (so the matrix can't drift from enforcement); these enforce shape.
 */

"use strict";

const { z } = require("zod");

const uuid = z.string().uuid();
const roleName = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9_]+$/, "role_name must be snake_case (a-z, 0-9, _)");

const roleCreateSchema = z.object({
  role_name: roleName,
  description: z.string().max(500).optional(),
  scope: z.enum(["brand", "system"]).default("brand"),
});
const roleUpdateSchema = z
  .object({
    role_name: roleName.optional(),
    description: z.string().max(500).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "No fields to update");

const grantSchema = z.object({
  module: z.string().min(1).max(60),
  action: z.string().min(1).max(20),
  record_scope: z.enum(["all", "own", "team"]).default("all"),
  hidden_fields: z.array(z.string().max(80)).max(200).optional(),
});
const permissionsSchema = z.object({
  grants: z.array(grantSchema).max(500),
});

const grantRoleSchema = z.object({
  role_id: uuid,
  business: z.string().min(1).max(60), // brand key or '*'
  expires_at: z.string().datetime().nullable().optional(),
});

const userAccessSchema = z
  .object({
    permitted_businesses: z.array(z.string().min(1).max(60)).max(50).optional(),
    default_business: z.string().min(1).max(60).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "No fields to update");

const revokeQuerySchema = z.object({
  business: z.string().min(1).max(60),
});

function makeBody(schema) {
  return function validate(req, _res, next) {
    req.body = schema.parse(req.body || {});
    next();
  };
}
function makeQuery(schema) {
  return function validate(req, _res, next) {
    schema.parse(req.query || {});
    next();
  };
}

module.exports = {
  validateRoleCreate: makeBody(roleCreateSchema),
  validateRoleUpdate: makeBody(roleUpdateSchema),
  validatePermissions: makeBody(permissionsSchema),
  validateGrantRole: makeBody(grantRoleSchema),
  validateUserAccess: makeBody(userAccessSchema),
  validateRevokeQuery: makeQuery(revokeQuerySchema),
  roleCreateSchema,
  permissionsSchema,
  grantRoleSchema,
};
