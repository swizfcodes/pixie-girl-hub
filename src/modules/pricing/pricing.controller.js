/**
 * Pricing Engine (V2.2 §6.25) — HTTP controller.
 */

"use strict";

const service = require("./pricing.service");

const base = (req) => ({
  brand: req.brand,
  user: req.user,
  request_id: req.request_id,
});

// ── Rules ──────────────────────────────────────────────────
async function listRules(req, res) {
  res.json({
    data: await service.listRules({
      brand: req.brand,
      channel: req.query.channel,
      is_active:
        req.query.is_active === undefined
          ? undefined
          : req.query.is_active === "true",
    }),
  });
}
async function createRule(req, res) {
  res.status(201).json({
    data: await service.createRule({ ...base(req), input: req.body }),
  });
}
async function updateRule(req, res) {
  res.json({
    data: await service.updateRule({
      ...base(req),
      id: req.params.id,
      patch: req.body,
    }),
  });
}
async function deactivateRule(req, res) {
  res.json({
    data: await service.deactivateRule({ ...base(req), id: req.params.id }),
  });
}

// ── Floors ─────────────────────────────────────────────────
async function listFloors(req, res) {
  res.json({
    data: await service.listFloors({
      brand: req.brand,
      variant_id: req.query.variant_id,
    }),
  });
}
async function setFloor(req, res) {
  res
    .status(201)
    .json({ data: await service.setFloor({ ...base(req), input: req.body }) });
}
async function removeFloor(req, res) {
  await service.removeFloor({ ...base(req), id: req.params.id });
  res.status(204).end();
}

// ── Overrides ──────────────────────────────────────────────
async function listOverrides(req, res) {
  res.json({
    data: await service.listOverrides({
      brand: req.brand,
      variant_id: req.query.variant_id,
    }),
  });
}
async function setOverride(req, res) {
  res.status(201).json({
    data: await service.setOverride({ ...base(req), input: req.body }),
  });
}
async function removeOverride(req, res) {
  await service.removeOverride({ ...base(req), id: req.params.id });
  res.status(204).end();
}

// ── Effective price (resolver) ─────────────────────────────
async function effectivePrice(req, res) {
  res.json({
    data: await service.getEffectivePrice({
      brand: req.brand,
      variant_id: req.params.variant_id,
      channel: req.query.channel || "storefront",
      currency: req.query.currency || "NGN",
    }),
  });
}

// ── Scenarios ──────────────────────────────────────────────
async function listScenarios(req, res) {
  res.json({
    data: await service.listScenarios({
      brand: req.brand,
      status: req.query.status,
    }),
  });
}
async function getScenario(req, res) {
  res.json({
    data: await service.getScenario({ brand: req.brand, id: req.params.id }),
  });
}
async function createScenario(req, res) {
  res.status(201).json({
    data: await service.createScenario({ ...base(req), input: req.body }),
  });
}
async function computeScenario(req, res) {
  res.json({
    data: await service.computeScenario({
      ...base(req),
      id: req.params.id,
      sliders: req.body.sliders,
    }),
  });
}

// ── Proposals ──────────────────────────────────────────────
async function listProposals(req, res) {
  res.json({
    data: await service.listProposals({
      brand: req.brand,
      status: req.query.status,
    }),
  });
}
async function getProposal(req, res) {
  res.json({
    data: await service.getProposal({ brand: req.brand, id: req.params.id }),
  });
}
async function createProposal(req, res) {
  res.status(201).json({
    data: await service.createProposalFromScenario({
      ...base(req),
      input: req.body,
    }),
  });
}
async function approveProposal(req, res) {
  res.json({
    data: await service.approveProposal({ ...base(req), id: req.params.id }),
  });
}
async function rejectProposal(req, res) {
  res.json({
    data: await service.rejectProposal({
      ...base(req),
      id: req.params.id,
      reason: req.body.reason,
    }),
  });
}
async function revertProposal(req, res) {
  res.json({
    data: await service.revertProposal({
      ...base(req),
      id: req.params.id,
      reason: req.body.reason,
    }),
  });
}

// ── History ────────────────────────────────────────────────
async function priceHistory(req, res) {
  res.json({
    data: await service.priceHistory({
      brand: req.brand,
      variant_id: req.params.variant_id,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
  });
}

module.exports = {
  listRules,
  createRule,
  updateRule,
  deactivateRule,
  listFloors,
  setFloor,
  removeFloor,
  listOverrides,
  setOverride,
  removeOverride,
  effectivePrice,
  listScenarios,
  getScenario,
  createScenario,
  computeScenario,
  listProposals,
  getProposal,
  createProposal,
  approveProposal,
  rejectProposal,
  revertProposal,
  priceHistory,
};
