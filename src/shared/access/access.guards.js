/**
 * Access escalation guards (V2.2 §3 — RBAC).
 *
 * Pure functions (throw on violation) that stop a delegated administrator —
 * someone with `settings` permission but who is NOT the owner/CEO — from
 * escalating their own privileges. The owner (is_ceo) bypasses these, as the
 * owner already bypasses all permission checks.
 *
 * Rules:
 *   - System roles (is_system) cannot be deleted by anyone (foundational).
 *   - System roles' definition/permissions can only be changed by the owner.
 *   - The `owner` role can only be granted/revoked by the owner.
 */

"use strict";

const { PermissionDeniedError, ConflictError } = require("../../utils/errors");

// Seeded owner role (shared.roles) — the CEO/superuser role.
const OWNER_ROLE_ID = "11111111-1111-1111-1111-000000000001";

const isOwnerActor = (actor) => Boolean(actor && actor.is_ceo);
const isOwnerRole = (role) => role && role.role_id === OWNER_ROLE_ID;

function assertCanMutateRole(actor, role) {
  if (role && role.is_system && !isOwnerActor(actor)) {
    throw new PermissionDeniedError("Only the owner can modify a system role");
  }
}

function assertCanDeleteRole(actor, role) {
  if (role && role.is_system) {
    throw new ConflictError("System roles cannot be deleted");
  }
}

function assertCanEditPermissions(actor, role) {
  if (role && role.is_system && !isOwnerActor(actor)) {
    throw new PermissionDeniedError(
      "Only the owner can edit a system role's permissions",
    );
  }
}

function assertCanGrantRole(actor, role) {
  if (isOwnerRole(role) && !isOwnerActor(actor)) {
    throw new PermissionDeniedError("Only the owner can grant the owner role");
  }
}

function assertCanRevokeRole(actor, role) {
  if (isOwnerRole(role) && !isOwnerActor(actor)) {
    throw new PermissionDeniedError("Only the owner can revoke the owner role");
  }
}

module.exports = {
  OWNER_ROLE_ID,
  isOwnerActor,
  isOwnerRole,
  assertCanMutateRole,
  assertCanDeleteRole,
  assertCanEditPermissions,
  assertCanGrantRole,
  assertCanRevokeRole,
};
