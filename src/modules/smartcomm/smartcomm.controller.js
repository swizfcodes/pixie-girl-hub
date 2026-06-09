/**
 * Messaging Smartcomm (V2.2 §6.17) — HTTP controller.
 */

"use strict";

const service = require("./smartcomm.service");
const { parsePagination } = require("../../utils/pagination");

async function listChannels(req, res) {
  const { page, page_size } = parsePagination(req.query);
  res.json(
    await service.listChannels({
      brand: req.brand,
      channel_type: req.query.channel_type,
      page,
      page_size,
    }),
  );
}
async function getChannel(req, res) {
  res.json({ data: await service.getChannel({ id: req.params.id }) });
}
async function postMessage(req, res) {
  res.status(201).json({
    data: await service.postMessage({
      brand: req.brand,
      user: req.user,
      request_id: req.request_id,
      id: req.params.id,
      input: req.body,
    }),
  });
}
async function sendToCustomer(req, res) {
  res.status(201).json({
    data: await service.sendToCustomer({
      brand: req.brand,
      user: req.user,
      contact_id: req.body.contact_id,
      channel: req.body.channel,
      subject: req.body.subject,
      body: req.body.body,
    }),
  });
}

module.exports = { listChannels, getChannel, postMessage, sendToCustomer };
