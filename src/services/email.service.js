/**
 * Email sender (V2.2 §6.16 — Nodemailer over transactional SMTP, no Klaviyo).
 * Used by: email campaigns, transactional notifications, retention workflows.
 */

"use strict";

const nodemailer = require("nodemailer");
const { config } = require("../config/env");

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER
        ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
        : undefined,
    });
  }
  return transporter;
}

async function send({
  to,
  subject,
  html,
  text,
  from_email,
  from_name,
  headers,
}) {
  const t = getTransporter();
  return t.sendMail({
    to,
    from: `${from_name || config.SMTP_FROM_NAME} <${from_email || config.SMTP_FROM_EMAIL}>`,
    subject,
    html,
    text,
    headers,
  });
}

module.exports = { send };
