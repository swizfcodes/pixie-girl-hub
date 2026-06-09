/**
 * Smartcomm subscriber (G-4) — dispatch the layaway gentle reminder to the
 * customer over WhatsApp when `order.payment_reminder` fires, with the running
 * balance and the pay-link (the order's public_tracking_token). Best-effort
 * (soft): an unreachable contact or provider error is logged, not thrown.
 * Registered once.
 */

"use strict";

const salesEvents = require("../sales/sales.events");
const service = require("./smartcomm.service");
const { config } = require("../../config/env");
const { logger } = require("../../config/logger");

let registered = false;

function payLink(token) {
  if (!token) return "";
  const base = config.STOREFRONT_BASE_URL || "";
  return base ? `${base}/pay/${token}` : `/pay/${token}`;
}

function register() {
  if (registered) return;
  registered = true;

  salesEvents.on(
    "order.payment_reminder",
    async ({
      brand,
      contact_id,
      order_number,
      total_ngn,
      amount_paid_ngn,
      balance_due_ngn,
      public_tracking_token,
    }) => {
      if (!contact_id) return;
      const link = payLink(public_tracking_token);
      const body =
        `Hi! You've paid ₦${amount_paid_ngn || 0} of ₦${total_ngn} on order ` +
        `${order_number} (₦${balance_due_ngn} left). Pay any amount${
          link ? `: ${link}` : " anytime"
        }.`;
      try {
        await service.sendToCustomer({
          brand,
          contact_id,
          channel: "whatsapp",
          body,
          soft: true,
        });
      } catch (err) {
        logger.error(
          { err: err.message, brand, order_number },
          "smartcomm: layaway reminder dispatch failed",
        );
      }
    },
  );

  logger.info(
    "smartcomm subscribers registered (sales.order.payment_reminder → WhatsApp)",
  );
}

register();

module.exports = { register };
