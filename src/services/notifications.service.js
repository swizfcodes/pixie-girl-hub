/**
 * Centralised notification service — writes to shared.notifications and pushes
 * over socket.io. Columns match the schema (000004): user_id, business, type,
 * priority, title, body, reference_type, reference_id, is_read.
 */

"use strict";

const { query } = require("../config/database");
const { getIo } = require("../config/socket");
const { ROOMS } = require("../realtime/rooms");

const VALID_PRIORITY = new Set(["low", "normal", "high", "urgent"]);

/**
 * Create an in-app notification for a user (+ realtime push). Safe to call
 * from request or worker context; a socket gap is ignored.
 */
async function notify({
  user_id,
  business,
  type,
  title,
  body,
  priority = "normal",
  reference_type,
  reference_id,
}) {
  if (!user_id) return null;
  const prio = VALID_PRIORITY.has(priority) ? priority : "normal";
  const { rows } = await query(
    `INSERT INTO shared.notifications
       (user_id, business, type, priority, title, body, reference_type, reference_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING notification_id, created_at`,
    [
      user_id,
      business || null,
      type,
      prio,
      title,
      body || null,
      reference_type || null,
      reference_id || null,
    ],
  );
  try {
    getIo().to(ROOMS.user_notifications(user_id)).emit("notification", {
      id: rows[0].notification_id,
      type,
      title,
      body,
      priority: prio,
      created_at: rows[0].created_at,
    });
  } catch {
    // socket.io not ready (worker context); skip silently
  }
  return rows[0];
}

async function list({ user_id, only_unread, page = 1, page_size = 30 }) {
  const where = ["user_id = $1"];
  const params = [user_id];
  if (only_unread) where.push("is_read = false");
  const w = `WHERE ${where.join(" AND ")}`;
  const { rows: c } = await query(
    `SELECT count(*)::int AS total FROM shared.notifications ${w}`,
    params,
  );
  const offset = (page - 1) * page_size;
  const { rows } = await query(
    `SELECT * FROM shared.notifications ${w}
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [user_id, page_size, offset],
  );
  return { data: rows, page, page_size, total: c[0].total };
}

async function unreadCount({ user_id }) {
  const { rows } = await query(
    `SELECT count(*)::int AS unread FROM shared.notifications
      WHERE user_id = $1 AND is_read = false`,
    [user_id],
  );
  return rows[0].unread;
}

async function markRead({ user_id, id }) {
  const { rows } = await query(
    `UPDATE shared.notifications SET is_read = true, read_at = now()
      WHERE notification_id = $1 AND user_id = $2 RETURNING *`,
    [id, user_id],
  );
  return rows[0] || null;
}

async function markAllRead({ user_id }) {
  const { rowCount } = await query(
    `UPDATE shared.notifications SET is_read = true, read_at = now()
      WHERE user_id = $1 AND is_read = false`,
    [user_id],
  );
  return { marked: rowCount };
}

module.exports = { notify, list, unreadCount, markRead, markAllRead };
