/**
 * Email Campaigns (V2.2 §6.16) — HTTP controller.
 */

"use strict";

const service = require("./email-campaigns.service");
const { parsePagination } = require("../../utils/pagination");

const base = (req) => ({
  brand: req.brand,
  user: req.user,
  request_id: req.request_id,
});

const VALID_BRANDS = new Set(["pixiegirl", "faitlynhair"]);
function brandHint(req) {
  const h = req.brand || req.headers["x-brand-context"] || req.query.brand;
  return VALID_BRANDS.has(h) ? h : "pixiegirl";
}

// Templates
async function listTemplates(req, res) {
  res.json({ data: await service.listTemplates({ brand: req.brand }) });
}
async function createTemplate(req, res) {
  res.status(201).json({
    data: await service.createTemplate({ ...base(req), input: req.body }),
  });
}
async function updateTemplate(req, res) {
  res.json({
    data: await service.updateTemplate({
      ...base(req),
      id: req.params.id,
      patch: req.body,
    }),
  });
}

// Campaigns
async function listCampaigns(req, res) {
  const { page, page_size } = parsePagination(req.query);
  res.json(
    await service.listCampaigns({
      brand: req.brand,
      status: req.query.status,
      page,
      page_size,
    }),
  );
}
async function getCampaign(req, res) {
  res.json({
    data: await service.getCampaign({ brand: req.brand, id: req.params.id }),
  });
}
async function createCampaign(req, res) {
  res.status(201).json({
    data: await service.createCampaign({ ...base(req), input: req.body }),
  });
}
async function buildRecipients(req, res) {
  res.json({
    data: await service.buildRecipients({
      ...base(req),
      id: req.params.id,
      contact_ids: req.body.contact_ids,
    }),
  });
}
async function sendCampaign(req, res) {
  res.json({
    data: await service.sendCampaign({ ...base(req), id: req.params.id }),
  });
}
async function pauseCampaign(req, res) {
  res.json({
    data: await service.setStatus({
      ...base(req),
      id: req.params.id,
      status: "paused",
    }),
  });
}
async function cancelCampaign(req, res) {
  res.json({
    data: await service.setStatus({
      ...base(req),
      id: req.params.id,
      status: "cancelled",
    }),
  });
}
async function recordEvent(req, res) {
  res.json({
    data: await service.recordEvent({
      brand: req.brand,
      campaign_id: req.params.id,
      email: req.body.email,
      event_type: req.body.event_type,
    }),
  });
}

// Public newsletter
async function subscribeNewsletter(req, res) {
  res.status(201).json({
    data: await service.subscribeNewsletter({
      brand: brandHint(req),
      input: req.body,
    }),
  });
}

module.exports = {
  listTemplates,
  createTemplate,
  updateTemplate,
  listCampaigns,
  getCampaign,
  createCampaign,
  buildRecipients,
  sendCampaign,
  pauseCampaign,
  cancelCampaign,
  recordEvent,
  subscribeNewsletter,
};
