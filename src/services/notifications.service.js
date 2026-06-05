/**
 * Centralised notification dispatch.
 * Routes a notification by user preference: in-app + email + whatsapp.
 */

"use strict";

const { query } = require("../config/database");
const { getIo } = require("../config/socket");
const { ROOMS } = require("../realtime/rooms");

async function notify({
  user_id,
  type,
  title,
  body,
  link_url,
  link_target_id,
  link_target_type,
  severity = "info",
  metadata,
}) {
  // 1. Persist to shared.notifications
  const { rows } = await query(
    `INSERT INTO shared.notifications
       (user_id, type, title, body, link_url, link_target_id, link_target_type, severity, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING notification_id, created_at`,
    [
      user_id,
      type,
      title,
      body,
      link_url,
      link_target_id,
      link_target_type,
      severity,
      metadata,
    ],
  );
  // 2. Push via socket.io
  try {
    const io = getIo();
    io.to(ROOMS.user_notifications(user_id)).emit("notification", {
      id: rows[0].notification_id,
      type,
      title,
      body,
      link_url,
      severity,
      created_at: rows[0].created_at,
    });
  } catch {
    // socket.io not ready (worker context); skip silently
  }
  return rows[0];
}

module.exports = { notify };
