/**
 * Approvals + workflow-definition controller. HTTP only.
 */

"use strict";

const service = require("./approvals.service");

async function listPending(req, res) {
  const result = await service.listPending({
    brand: req.brand,
    user: req.user,
    page: parseInt(req.query.page || "1", 10),
    page_size: Math.min(parseInt(req.query.page_size || "25", 10), 100),
  });
  res.json(result);
}

async function getInstance(req, res) {
  const data = await service.getInstance({
    brand: req.brand,
    instance_id: req.params.instance_id,
  });
  res.json({ data });
}

async function act(req, res) {
  const data = await service.act({
    brand: req.brand,
    user: req.user,
    request_id: req.request_id,
    instance_id: req.params.instance_id,
    action: req.body.action,
    notes: req.body.notes,
  });
  res.json({ data });
}

async function listDefinitions(req, res) {
  const result = await service.listDefinitions({
    brand: req.brand,
    include_inactive: req.query.include_inactive === "true",
  });
  res.json(result);
}

async function getDefinition(req, res) {
  const data = await service.getDefinition({
    brand: req.brand,
    workflow_id: req.params.workflow_id,
  });
  res.json({ data });
}

async function createDefinition(req, res) {
  const data = await service.createDefinition({
    brand: req.brand,
    user: req.user,
    request_id: req.request_id,
    input: req.body,
  });
  res.status(201).json({ data });
}

async function setDefinitionActive(req, res) {
  const data = await service.setDefinitionActive({
    brand: req.brand,
    user: req.user,
    request_id: req.request_id,
    workflow_id: req.params.workflow_id,
    is_active: req.body.is_active,
  });
  res.json({ data });
}

module.exports = {
  listPending,
  getInstance,
  act,
  listDefinitions,
  getDefinition,
  createDefinition,
  setDefinitionActive,
};
