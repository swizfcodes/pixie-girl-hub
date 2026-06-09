/**
 * Email Campaigns (V2.2 §6.16) — repository.
 *
 * Per-brand: email_templates, email_campaigns, email_campaign_recipients,
 * email_campaign_events. Recipients are sourced from shared.contacts (system
 * data, not an isolated list). Parameterised SQL only.
 */

"use strict";

const { query } = require("../../config/database");
const { t } = require("../../config/brands");

const ex = (c) => (c ? c.query.bind(c) : query);

async function nextNumber({ client, brand }) {
  const { rows } = await ex(client)(
    `SELECT ${t(brand, "fn_next_document_number")}('email_campaign') AS n`,
  );
  return rows[0].n;
}

// ── Templates ──────────────────────────────────────────────
async function listTemplates({ brand }) {
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "email_templates")}
      WHERE is_active = true ORDER BY display_name`,
  );
  return rows;
}
async function getTemplate({ client, brand, id }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "email_templates")} WHERE template_id = $1`,
    [id],
  );
  return rows[0] || null;
}
async function createTemplate({ brand, tpl }) {
  const { rows } = await query(
    `INSERT INTO ${t(brand, "email_templates")}
       (template_key, display_name, subject_line, html_body, available_variables,
        from_name, from_email, reply_to_email, status)
     VALUES ($1,$2,$3,$4,COALESCE($5,'{}'),$6,$7,$8,COALESCE($9,'draft'))
     RETURNING *`,
    [
      tpl.template_key,
      tpl.display_name,
      tpl.subject_line,
      tpl.html_body,
      tpl.available_variables,
      tpl.from_name || null,
      tpl.from_email || null,
      tpl.reply_to_email || null,
      tpl.status,
    ],
  );
  return rows[0];
}
async function updateTemplate({ brand, id, patch }) {
  const cols = [
    "display_name",
    "subject_line",
    "html_body",
    "from_name",
    "from_email",
    "reply_to_email",
    "status",
    "is_active",
  ];
  const set = [];
  const params = [id];
  let i = 2;
  for (const c of cols) {
    if (patch[c] === undefined) continue;
    set.push(`${c} = $${i++}`);
    params.push(patch[c]);
  }
  if (!set.length) return getTemplate({ brand, id });
  const { rows } = await query(
    `UPDATE ${t(brand, "email_templates")} SET ${set.join(", ")}, updated_at = now()
      WHERE template_id = $1 RETURNING *`,
    params,
  );
  return rows[0] || null;
}

// ── Campaigns ──────────────────────────────────────────────
async function createCampaign({ client, brand, c }) {
  const { rows } = await ex(client)(
    `INSERT INTO ${t(brand, "email_campaigns")}
       (campaign_number, campaign_name, campaign_type, segment_id,
        default_template_id, from_name, from_email, reply_to_email, status,
        scheduled_for)
     VALUES ($1,$2,COALESCE($3,'one_off'),$4,$5,$6,$7,$8,'draft',$9)
     RETURNING *`,
    [
      c.campaign_number,
      c.campaign_name,
      c.campaign_type,
      c.segment_id || null,
      c.default_template_id || null,
      c.from_name || null,
      c.from_email || null,
      c.reply_to_email || null,
      c.scheduled_for || null,
    ],
  );
  return rows[0];
}
async function getCampaign({ client, brand, id }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "email_campaigns")} WHERE campaign_id = $1`,
    [id],
  );
  return rows[0] || null;
}
async function listCampaigns({ brand, status, page = 1, page_size = 25 }) {
  const where = [];
  const params = [];
  let i = 1;
  if (status) {
    where.push(`status = $${i++}`);
    params.push(status);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows: cnt } = await query(
    `SELECT count(*)::int AS total FROM ${t(brand, "email_campaigns")} ${w}`,
    params,
  );
  const offset = (page - 1) * page_size;
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "email_campaigns")} ${w}
      ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, page_size, offset],
  );
  return { data: rows, page, page_size, total: cnt[0].total };
}
async function setCampaignStatus({ client, brand, id, status, fields = {} }) {
  const set = ["status = $2"];
  const params = [id, status];
  let i = 3;
  for (const [col, val] of Object.entries(fields)) {
    set.push(`${col} = $${i++}`);
    params.push(val);
  }
  const { rows } = await ex(client)(
    `UPDATE ${t(brand, "email_campaigns")} SET ${set.join(", ")}, updated_at = now()
      WHERE campaign_id = $1 RETURNING *`,
    params,
  );
  return rows[0] || null;
}
async function incCampaignCounter({ client, brand, id, column, by = 1 }) {
  const allowed = new Set([
    "total_sent",
    "total_delivered",
    "total_opened",
    "total_clicked",
    "total_bounced",
    "total_unsubscribed",
  ]);
  if (!allowed.has(column)) return;
  await ex(client)(
    `UPDATE ${t(brand, "email_campaigns")}
        SET ${column} = ${column} + $2, updated_at = now() WHERE campaign_id = $1`,
    [id, by],
  );
}

// ── Recipients (sourced from contacts) ─────────────────────
async function addRecipientsFromContacts({ brand, campaign_id, contact_ids }) {
  // Brand-visible contacts with an email; optional explicit id filter.
  const params = [campaign_id, brand];
  let filter = "";
  if (Array.isArray(contact_ids) && contact_ids.length > 0) {
    params.push(contact_ids);
    filter = `AND c.contact_id = ANY($3)`;
  }
  const { rowCount } = await query(
    `INSERT INTO ${t(brand, "email_campaign_recipients")}
       (campaign_id, contact_id, email, contact_name_snapshot, status)
     SELECT $1, c.contact_id, c.email, c.display_name, 'queued'
       FROM shared.contacts c
      WHERE c.is_deleted = false AND c.email IS NOT NULL
        AND ($2 = ANY(c.visible_to) OR c.visible_to = '{}')
        ${filter}
     ON CONFLICT (campaign_id, email) DO NOTHING`,
    params,
  );
  return rowCount;
}
async function listRecipients({
  brand,
  campaign_id,
  status,
  page = 1,
  page_size = 50,
}) {
  const where = ["campaign_id = $1"];
  const params = [campaign_id];
  let i = 2;
  if (status) {
    where.push(`status = $${i++}`);
    params.push(status);
  }
  const w = `WHERE ${where.join(" AND ")}`;
  const offset = (page - 1) * page_size;
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "email_campaign_recipients")} ${w}
      ORDER BY queued_at LIMIT $${i++} OFFSET $${i}`,
    [...params, page_size, offset],
  );
  return rows;
}
async function queuedRecipients({ client, brand, campaign_id, limit = 500 }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "email_campaign_recipients")}
      WHERE campaign_id = $1 AND status = 'queued' LIMIT $2`,
    [campaign_id, limit],
  );
  return rows;
}
async function setRecipientStatus({
  client,
  brand,
  recipient_id,
  status,
  fields = {},
}) {
  const set = ["status = $2"];
  const params = [recipient_id, status];
  let i = 3;
  for (const [col, val] of Object.entries(fields)) {
    set.push(`${col} = $${i++}`);
    params.push(val);
  }
  await ex(client)(
    `UPDATE ${t(brand, "email_campaign_recipients")} SET ${set.join(", ")}
      WHERE recipient_id = $1`,
    params,
  );
}
async function findRecipientByEmail({ brand, campaign_id, email }) {
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "email_campaign_recipients")}
      WHERE campaign_id = $1 AND email = $2`,
    [campaign_id, email],
  );
  return rows[0] || null;
}

async function insertEvent({ client, brand, ev }) {
  await ex(client)(
    `INSERT INTO ${t(brand, "email_campaign_events")}
       (recipient_id, campaign_id, event_type) VALUES ($1,$2,$3)`,
    [ev.recipient_id, ev.campaign_id, ev.event_type],
  );
}

module.exports = {
  nextNumber,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  createCampaign,
  getCampaign,
  listCampaigns,
  setCampaignStatus,
  incCampaignCounter,
  addRecipientsFromContacts,
  listRecipients,
  queuedRecipients,
  setRecipientStatus,
  findRecipientByEmail,
  insertEvent,
};
