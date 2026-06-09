/**
 * Email Campaigns (V2.2 §6.16) — business logic.
 *
 * System-connected: recipients are built from shared.contacts; sends go
 * through the real email provider (services/email.service); opens/clicks/
 * bounces flow back as events that update recipient + campaign counters;
 * newsletter signups become CRM contacts (source='website'). No isolated list.
 */

"use strict";

const repo = require("./email-campaigns.repo");
const events = require("./email-campaigns.events");
const email = require("../../services/email.service");
const { audit } = require("../../middleware/audit");
const { transaction, query } = require("../../config/database");
const { logger } = require("../../config/logger");
const { NotFoundError, AppError } = require("../../utils/errors");

const SEND_CAP = 1000; // synchronous send cap per call

function render(str, tokens) {
  return String(str || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) =>
    tokens[k] === null ? "" : String(tokens[k]),
  );
}

// ── Templates ──────────────────────────────────────────────
function listTemplates({ brand }) {
  return repo.listTemplates({ brand });
}
async function createTemplate({ brand, user, request_id, input }) {
  const tpl = await repo.createTemplate({ brand, tpl: input });
  await audit({
    business: brand,
    user_id: user.user_id,
    action_key: "email_campaigns.template.create",
    target_type: "email_template",
    target_id: tpl.template_id,
    request_id,
  });
  return tpl;
}
async function updateTemplate({ brand, user, request_id, id, patch }) {
  const tpl = await repo.updateTemplate({ brand, id, patch });
  if (!tpl) throw new NotFoundError("Template");
  await audit({
    business: brand,
    user_id: user.user_id,
    action_key: "email_campaigns.template.update",
    target_type: "email_template",
    target_id: id,
    request_id,
  });
  return tpl;
}

// ── Campaigns ──────────────────────────────────────────────
function listCampaigns(args) {
  return repo.listCampaigns(args);
}
async function getCampaign({ brand, id }) {
  const c = await repo.getCampaign({ brand, id });
  if (!c) throw new NotFoundError("Campaign");
  return c;
}
async function createCampaign({ brand, user, request_id, input }) {
  return transaction(async (client) => {
    const campaign_number = await repo.nextNumber({ client, brand });
    const c = await repo.createCampaign({
      client,
      brand,
      c: { ...input, campaign_number },
    });
    await audit({
      business: brand,
      user_id: user.user_id,
      action_key: "email_campaigns.create",
      target_type: "email_campaign",
      target_id: c.campaign_id,
      after: { campaign_number },
      request_id,
    });
    events.emit("created", { brand, id: c.campaign_id });
    return c;
  });
}

/** Populate recipients from contacts (optionally a specific id list). */
async function buildRecipients({ brand, user, request_id, id, contact_ids }) {
  const c = await repo.getCampaign({ brand, id });
  if (!c) throw new NotFoundError("Campaign");
  if (!["draft", "scheduled"].includes(c.status))
    throw new AppError(
      "INVALID_STATE",
      `Cannot edit a '${c.status}' campaign`,
      409,
    );
  const added = await repo.addRecipientsFromContacts({
    brand,
    campaign_id: id,
    contact_ids,
  });
  await audit({
    business: brand,
    user_id: user.user_id,
    action_key: "email_campaigns.recipients.build",
    target_type: "email_campaign",
    target_id: id,
    after: { added },
    request_id,
  });
  return { added };
}

/** Send the campaign now: render the template per recipient + dispatch. */
async function sendCampaign({ brand, user, request_id, id }) {
  const campaign = await repo.getCampaign({ brand, id });
  if (!campaign) throw new NotFoundError("Campaign");
  if (!["draft", "scheduled", "sending"].includes(campaign.status))
    throw new AppError(
      "INVALID_STATE",
      `Cannot send a '${campaign.status}' campaign`,
      409,
    );
  if (!campaign.default_template_id)
    throw new AppError("NO_TEMPLATE", "Campaign has no default template", 422);
  const template = await repo.getTemplate({
    brand,
    id: campaign.default_template_id,
  });
  if (!template) throw new NotFoundError("Template");

  await repo.setCampaignStatus({ brand, id, status: "sending" });
  const recipients = await repo.queuedRecipients({
    brand,
    campaign_id: id,
    limit: SEND_CAP,
  });

  let sent = 0;
  for (const r of recipients) {
    const tokens = { customer_name: r.contact_name_snapshot, email: r.email };
    try {
      await email.send({
        to: r.email,
        subject: render(template.subject_line, tokens),
        html: render(template.html_body, tokens),
        from_name: campaign.from_name || template.from_name,
        from_email: campaign.from_email || template.from_email,
      });
      await repo.setRecipientStatus({
        brand,
        recipient_id: r.recipient_id,
        status: "sent",
        fields: { sent_at: new Date().toISOString() },
      });
      await repo.insertEvent({
        brand,
        ev: {
          recipient_id: r.recipient_id,
          campaign_id: id,
          event_type: "sent",
        },
      });
      await repo.incCampaignCounter({ brand, id, column: "total_sent" });
      sent += 1;
    } catch (err) {
      await repo.setRecipientStatus({
        brand,
        recipient_id: r.recipient_id,
        status: "failed",
      });
      logger.error(
        { err: err.message, brand, recipient_id: r.recipient_id },
        "email campaign send failed for recipient",
      );
    }
  }

  const remaining = await repo.queuedRecipients({
    brand,
    campaign_id: id,
    limit: 1,
  });
  const status = remaining.length > 0 ? "sending" : "sent";
  const updated = await repo.setCampaignStatus({
    brand,
    id,
    status,
    fields: { sent_at: new Date().toISOString() },
  });
  await audit({
    business: brand,
    user_id: user.user_id,
    action_key: "email_campaigns.send",
    target_type: "email_campaign",
    target_id: id,
    after: { sent },
    request_id,
  });
  events.emit("sent", { brand, id, sent });
  return { ...updated, sent_this_batch: sent };
}

async function setStatus({ brand, user, request_id, id, status }) {
  const c = await repo.getCampaign({ brand, id });
  if (!c) throw new NotFoundError("Campaign");
  const updated = await repo.setCampaignStatus({ brand, id, status });
  await audit({
    business: brand,
    user_id: user.user_id,
    action_key: `email_campaigns.${status}`,
    target_type: "email_campaign",
    target_id: id,
    request_id,
  });
  return updated;
}

/** Provider webhook: record an engagement event + roll up counters. */
async function recordEvent({ brand, campaign_id, email: addr, event_type }) {
  const r = await repo.findRecipientByEmail({
    brand,
    campaign_id,
    email: addr,
  });
  if (!r) return null;
  await repo.insertEvent({
    brand,
    ev: { recipient_id: r.recipient_id, campaign_id, event_type },
  });
  const map = {
    delivered: { status: "delivered", col: "total_delivered" },
    opened: {
      col: "total_opened",
      field: { first_opened_at: new Date().toISOString() },
    },
    clicked: {
      col: "total_clicked",
      field: { first_clicked_at: new Date().toISOString() },
    },
    bounced: {
      status: "bounced",
      col: "total_bounced",
      field: { bounced_at: new Date().toISOString() },
    },
    unsubscribed: {
      status: "unsubscribed",
      col: "total_unsubscribed",
      field: { unsubscribed_at: new Date().toISOString() },
    },
  };
  const m = map[event_type];
  if (m) {
    await repo.setRecipientStatus({
      brand,
      recipient_id: r.recipient_id,
      status: m.status || r.status,
      fields: m.field || {},
    });
    if (m.col)
      await repo.incCampaignCounter({ brand, id: campaign_id, column: m.col });
  }
  return { recorded: event_type };
}

// ── Newsletter (public) — connects into CRM contacts ───────
async function subscribeNewsletter({ brand, input }) {
  if (!input.email || !input.phone)
    throw new AppError(
      "EMAIL_PHONE_REQUIRED",
      "Email and phone are required to subscribe",
      422,
    );
  // Merge by email or phone; else create a contact tagged source='website'.
  const { rows: existing } = await query(
    `SELECT contact_id FROM shared.contacts
      WHERE is_deleted = false AND (email = $1 OR primary_phone = $2) LIMIT 1`,
    [input.email, input.phone],
  );
  if (existing[0])
    return { contact_id: existing[0].contact_id, created: false };
  const display_name =
    [input.first_name, input.last_name].filter(Boolean).join(" ") ||
    input.email;
  const { rows } = await query(
    `INSERT INTO shared.contacts
       (contact_type, display_name, first_name, last_name, primary_phone, email,
        source, visible_to)
     VALUES (ARRAY['lead'], $1, $2, $3, $4, $5, 'website', ARRAY[$6])
     RETURNING contact_id`,
    [
      display_name,
      input.first_name || null,
      input.last_name || null,
      input.phone,
      input.email,
      brand,
    ],
  );
  events.emit("newsletter.subscribed", {
    brand,
    contact_id: rows[0].contact_id,
  });
  return { contact_id: rows[0].contact_id, created: true };
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
  setStatus,
  recordEvent,
  subscribeNewsletter,
};
