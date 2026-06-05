/**
 * Business Setup (V2.2 §6.21)
 * Business logic layer. Repos handle SQL; controllers handle HTTP.
 * This file is where:
 *   - Validation beyond shape (cross-field, against DB state)
 *   - Workflow routing (approval / multi-step)
 *   - Domain event emission (for real-time + AI)
 *   - Audit logging
 *   - Transaction orchestration
 */

"use strict";

const repo = require("./business-setup.repo");
const events = require("./business-setup.events");
const { audit } = require("../../middleware/audit");
const { transaction } = require("../../config/database");
const { NotFoundError, AppError } = require("../../utils/errors");

async function list({ brand, user, scope, filters, page, page_size }) {
  return repo.findAll({
    brand,
    scope,
    user_id: user.user_id,
    filters,
    page,
    page_size,
  });
}

async function getById({ brand, user, scope, id }) {
  const item = await repo.findById({ brand, id, scope, user_id: user.user_id });
  if (!item) throw new NotFoundError("BusinessSetup");
  return item;
}

async function create({ brand, user, request_id, input }) {
  return transaction(async (client) => {
    const created = await repo.create({
      client,
      brand,
      user_id: user.user_id,
      input,
    });
    await audit({
      business: brand,
      user_id: user.user_id,
      action_key: "business_setup.create",
      target_type: "business_setup",
      target_id: created.id || created[Object.keys(created)[0]],
      after: created,
      request_id,
    });
    events.emit("created", { brand, item: created, user_id: user.user_id });
    return created;
  });
}

async function update({ brand, user, request_id, id, patch }) {
  return transaction(async (client) => {
    const before = await repo.findById({ client, brand, id });
    if (!before) throw new NotFoundError("BusinessSetup");
    const updated = await repo.update({ client, brand, id, patch });
    await audit({
      business: brand,
      user_id: user.user_id,
      action_key: "business_setup.update",
      target_type: "business_setup",
      target_id: id,
      before,
      after: updated,
      request_id,
    });
    events.emit("updated", { brand, item: updated, user_id: user.user_id });
    return updated;
  });
}

async function archive({ brand, user, request_id, id }) {
  return transaction(async (client) => {
    const before = await repo.findById({ client, brand, id });
    if (!before) throw new NotFoundError("BusinessSetup");
    await repo.archive({ client, brand, id });
    await audit({
      business: brand,
      user_id: user.user_id,
      action_key: "business_setup.archive",
      target_type: "business_setup",
      target_id: id,
      before,
      request_id,
    });
    events.emit("archived", { brand, id, user_id: user.user_id });
  });
}

module.exports = { list, getById, create, update, archive };
