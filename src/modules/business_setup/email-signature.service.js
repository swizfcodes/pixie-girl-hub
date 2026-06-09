/**
 * Email signatures (V2.2 §6.13) — business logic. One branded template,
 * auto-personalised per staff member by merging tokens.
 */

"use strict";

const repo = require("./email-signature.repo");
const { audit } = require("../../middleware/audit");
const { transaction } = require("../../config/database");
const { NotFoundError } = require("../../utils/errors");

/** Replace {{token}} placeholders with provided values (HTML-escaped). */
function escapeHtml(s) {
  return String(s === null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render(template, tokens) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key) =>
    escapeHtml(tokens[key] ?? ""),
  );
}

async function getTemplate({ brand }) {
  const cfg = await repo.getTemplate({ brand });
  if (!cfg) throw new NotFoundError("Business");
  return {
    business_name: cfg.display_name,
    email_signature_template: cfg.email_signature_template,
  };
}

async function setTemplate({ brand, user, request_id, html }) {
  return transaction(async (client) => {
    const updated = await repo.setTemplate({ client, brand, html });
    if (!updated) throw new NotFoundError("Business");
    await audit({
      business: brand,
      user_id: user.user_id,
      action_key: "business_setup.email_signature_template.update",
      target_type: "business_config",
      target_id: null,
      request_id,
    });
    return updated;
  });
}

function listSignatures({ brand }) {
  return repo.listSignatures({ brand });
}

async function getSignature({ brand, user_id }) {
  const sig = await repo.getSignature({ brand, user_id });
  if (!sig) throw new NotFoundError("Signature");
  return sig;
}

/**
 * Generate (or regenerate) a staff member's signature by merging their
 * details into the brand template, then store the rendered HTML.
 */
async function generateSignature({
  brand,
  user,
  request_id,
  user_id,
  full_name,
  job_title,
  phone,
}) {
  return transaction(async (client) => {
    const cfg = await repo.getTemplate({ client, brand });
    if (!cfg) throw new NotFoundError("Business");
    const html_content = render(cfg.email_signature_template, {
      full_name,
      job_title,
      phone,
      business_name: cfg.display_name,
    });
    const sig = await repo.upsertSignature({
      client,
      brand,
      sig: { user_id, full_name, job_title, phone, html_content },
    });
    await audit({
      business: brand,
      user_id: user.user_id,
      action_key: "business_setup.email_signature.generate",
      target_type: "email_signature",
      target_id: sig.signature_id,
      after: { user_id, full_name },
      request_id,
    });
    return sig;
  });
}

module.exports = {
  getTemplate,
  setTemplate,
  listSignatures,
  getSignature,
  generateSignature,
  render,
};
