/**
 * Notification fan-out — turns selected domain events into in-app
 * notifications for the relevant staff user. Best-effort; never blocks the
 * source flow. Registered once. (Customer-facing dispatch — WhatsApp/email —
 * is handled by the Smartcomm subscriber, not here.)
 *
 * Targets a user only where the event carries a clear user_id (e.g. the
 * salesperson who closed a sale). Role-based routing (approvals → approver)
 * is a later extension once org_workflow resolution is wired in.
 */

"use strict";

const salesEvents = require("../../modules/sales/sales.events");
const salesRepo = require("../../modules/sales/sales.repo");
const notifications = require("../../services/notifications.service");
const { logger } = require("../../config/logger");

let registered = false;

function register() {
  if (registered) return;
  registered = true;

  // A rep's sale was paid → notify the rep.
  salesEvents.on("order.paid", async ({ brand, order_id }) => {
    try {
      const order = await salesRepo.findById({ brand, id: order_id });
      if (!order || !order.created_by) return;
      await notifications.notify({
        user_id: order.created_by,
        business: brand,
        type: "order_status_change",
        priority: "normal",
        title: `Order ${order.order_number} paid`,
        body: `${order.order_number} is fully paid (₦${order.total_ngn}).`,
        reference_type: "sales_order",
        reference_id: order_id,
      });
    } catch (err) {
      logger.error(
        { err: err.message, brand, order_id },
        "notifications: order.paid fan-out failed",
      );
    }
  });

  logger.info("notifications subscribers registered (sales.order.paid → rep)");
}

register();

module.exports = { register };
