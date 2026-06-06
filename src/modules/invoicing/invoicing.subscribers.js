/**
 * Invoicing subscribers — auto-generate the customer invoice when a sales
 * order is paid in full. Best-effort: a failure here is logged and never
 * rolls back the order (the invoice can be re-generated). Registered once.
 */

"use strict";

const salesEvents = require("../sales/sales.events");
const salesRepo = require("../sales/sales.repo");
const service = require("./invoicing.service");
const { logger } = require("../../config/logger");

let registered = false;

function register() {
  if (registered) return;
  registered = true;
  salesEvents.on("order.paid", async ({ brand, order_id }) => {
    try {
      const order = await salesRepo.findById({ brand, id: order_id });
      if (!order) return;
      await service.createFromOrder({ brand, order, user_id: null });
    } catch (err) {
      logger.error(
        { err: err.message, brand, order_id },
        "invoicing: auto-invoice failed",
      );
    }
  });
  logger.info(
    "invoicing subscribers registered (sales.order.paid → auto-invoice)",
  );
}

register();

module.exports = { register };
