/**
 * Audit log read-access (V2.2 §3 — append-only)
 * HTTP controller — translates req/res to service calls. No business logic here.
 */

"use strict";

const service = require("./audit.service");

async function list(req, res) {
  const result = await service.list({
    brand: req.brand,
    user: req.user,
    scope: req.permission_scope,
    filters: req.query,
    page: parseInt(req.query.page || "1", 10),
    page_size: Math.min(parseInt(req.query.page_size || "25", 10), 100),
  });
  res.json(result);
}

async function getById(req, res) {
  const item = await service.getById({
    brand: req.brand,
    user: req.user,
    scope: req.permission_scope,
    id: req.params.id,
  });
  res.json({ data: item });
}

async function create(req, res) {
  const created = await service.create({
    brand: req.brand,
    user: req.user,
    request_id: req.request_id,
    input: req.body,
  });
  res.status(201).json({ data: created });
}

async function update(req, res) {
  const updated = await service.update({
    brand: req.brand,
    user: req.user,
    request_id: req.request_id,
    id: req.params.id,
    patch: req.body,
  });
  res.json({ data: updated });
}

async function archive(req, res) {
  await service.archive({
    brand: req.brand,
    user: req.user,
    request_id: req.request_id,
    id: req.params.id,
  });
  res.status(204).end();
}

module.exports = { list, getById, create, update, archive };
