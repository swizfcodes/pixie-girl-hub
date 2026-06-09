/**
 * Messaging Smartcomm (V2.2 §6.17) — business logic.
 *
 * Internal team channels + external customer threads, and outbound dispatch
 * to customers over WhatsApp / email (the existing provider services). This
 * is the dispatch layer that closes G-4: reminders, install-hub CTAs and
 * notifications that target a customer are sent here and recorded as messages.
 */

"use strict";

const repo = require("./smartcomm.repo");
const events = require("./smartcomm.events");
const whatsapp = require("../../services/whatsapp.service");
const email = require("../../services/email.service");
const { audit } = require("../../middleware/audit");
const { transaction } = require("../../config/database");
const { logger } = require("../../config/logger");
const { NotFoundError, AppError } = require("../../utils/errors");

function listChannels(args) {
  return repo.listChannels(args);
}

async function getChannel({ id }) {
  const channel = await repo.getChannel({ id });
  if (!channel) throw new NotFoundError("Channel");
  const messages = await repo.listMessages({ channel_id: id });
  return { ...channel, messages };
}

/** Post a message into a channel as the acting staff user. */
async function postMessage({ brand, user, request_id, id, input }) {
  return transaction(async (client) => {
    const channel = await repo.getChannel({ client, id });
    if (!channel) throw new NotFoundError("Channel");
    const msg = await repo.insertMessage({
      client,
      message: {
        channel_id: id,
        sender_user_id: user.user_id,
        message_type: input.message_type || "text",
        content: input.content,
        reply_to_id: input.reply_to_id,
      },
    });
    await audit({
      business: brand,
      user_id: user.user_id,
      action_key: "smartcomm.message.post",
      target_type: "message",
      target_id: msg.message_id,
      request_id,
    });
    events.emit("message.posted", {
      channel_id: id,
      message_id: msg.message_id,
    });
    return msg;
  });
}

async function findOrCreateCustomerThread({
  client,
  brand,
  contact_id,
  platform,
}) {
  const existing = await repo.findCustomerThread({ client, brand, contact_id });
  if (existing) return existing;
  return repo.createChannel({
    client,
    channel: {
      channel_type: "customer_thread",
      business: brand,
      external_platform: platform,
      metadata: { contact_id },
    },
  });
}

/**
 * Send an outbound message to a customer over WhatsApp or email and record it
 * on their thread. `automated` messages are stored as 'system'. Best-effort
 * for callers that pass { soft: true } (subscribers) — returns null instead
 * of throwing when the contact isn't reachable.
 */
async function sendToCustomer({
  brand,
  contact_id,
  channel = "whatsapp",
  subject,
  body,
  user,
  soft,
}) {
  const contact = await repo.getContactChannelInfo({ contact_id });
  if (!contact) {
    if (soft) return null;
    throw new NotFoundError("Contact");
  }

  let external_ref = null;
  try {
    if (channel === "email") {
      if (!contact.email) {
        if (soft) return null;
        throw new AppError("NO_EMAIL", "Contact has no email", 422);
      }
      const r = await email.send({
        to: contact.email,
        subject: subject || "A message from us",
        html: body,
      });
      external_ref = (r && (r.messageId || r.id)) || null;
    } else {
      const to = contact.whatsapp_number || contact.primary_phone;
      if (!to) {
        if (soft) return null;
        throw new AppError("NO_PHONE", "Contact has no phone/WhatsApp", 422);
      }
      const r = await whatsapp.sendText({ to, body });
      external_ref =
        (r && (r.id || (r.messages && r.messages[0] && r.messages[0].id))) ||
        null;
    }
  } catch (err) {
    logger.error(
      { err: err.message, brand, contact_id, channel },
      "smartcomm: outbound dispatch failed",
    );
    if (soft) return null;
    throw err;
  }

  const thread = await findOrCreateCustomerThread({
    brand,
    contact_id,
    platform: channel === "email" ? "email" : "whatsapp",
  });
  const msg = await repo.insertMessage({
    message: {
      channel_id: thread.channel_id,
      message_type: "system",
      content: body,
      external_ref,
    },
  });
  events.emit("customer.message_sent", {
    brand,
    contact_id,
    channel_id: thread.channel_id,
    message_id: msg.message_id,
  });
  return { channel_id: thread.channel_id, message: msg, external_ref };
}

/**
 * Record an INBOUND customer message (e.g. an Instagram DM bridged from Social
 * Media §6.14) onto the customer's thread, linked to their contact profile.
 */
async function recordInboundFromCustomer({
  brand,
  contact_id,
  platform,
  body,
  external_ref,
}) {
  const thread = await findOrCreateCustomerThread({
    brand,
    contact_id,
    platform: platform || "instagram",
  });
  const msg = await repo.insertMessage({
    message: {
      channel_id: thread.channel_id,
      sender_contact_id: contact_id,
      message_type: "text",
      content: body,
      external_ref,
    },
  });
  events.emit("customer.message_received", {
    brand,
    contact_id,
    channel_id: thread.channel_id,
    message_id: msg.message_id,
  });
  return { channel_id: thread.channel_id, message: msg };
}

module.exports = {
  listChannels,
  getChannel,
  postMessage,
  sendToCustomer,
  recordInboundFromCustomer,
  findOrCreateCustomerThread,
};
