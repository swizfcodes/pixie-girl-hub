/**
 * Accounting subscribers — the GL side of cross-module flows.
 *
 * On Sales `order.paid`, post the sale journal (best-effort; a GL hiccup must
 * never roll back the customer's paid order — it is logged and can be
 * re-posted). Expenses post directly via accounting.postEntry on approval, so
 * they are not handled here.
 *
 *   DR Bank/Cash            total
 *   DR COGS                 cost of goods           (if costs known)
 *      CR Revenue (channel) net (subtotal - discount)
 *      CR Shipping Revenue  shipping                (if any)
 *      CR VAT Output        tax                     (if any)
 *      CR Inventory (FG)    cost of goods           (if costs known)
 */

"use strict";

const salesEvents = require("../sales/sales.events");
const salesRepo = require("../sales/sales.repo");
const { money, toCurrencyString } = require("../../utils/money");
const { logger } = require("../../config/logger");

const REVENUE_BY_CHANNEL = {
  storefront: "4000",
  pos: "4010",
  instagram: "4020",
  whatsapp: "4030",
  wholesale: "4040",
  intercompany: "4050",
  subscription: "4060",
  public_form: "4000",
  facebook: "4020",
  tiktok: "4020",
  phone: "4000",
  event: "4010",
};

let registered = false;

function register() {
  if (registered) return;
  registered = true;

  salesEvents.on("order.paid", async ({ brand, order_id }) => {
    try {
      const accounting = require("./accounting.service");
      const order = await salesRepo.findById({ brand, id: order_id });
      if (!order) return;

      const subtotal = money(order.subtotal_ngn);
      const discount = money(order.discount_amount_ngn);
      const shipping = money(order.shipping_fee_ngn);
      const tax = money(order.tax_amount_ngn);
      const total = money(order.total_ngn);
      const net = subtotal.minus(discount);
      const cogs = (order.lines || []).reduce(
        (acc, l) => acc.plus(money(l.unit_cost_ngn || 0).times(l.quantity)),
        money(0),
      );

      const revenueCode = REVENUE_BY_CHANNEL[order.sales_channel] || "4000";
      const lines = [
        {
          account_code: "1100",
          debit_ngn: toCurrencyString(total),
          description: "Cash received",
        },
        {
          account_code: revenueCode,
          credit_ngn: toCurrencyString(net),
          description: "Sales revenue",
          contact_id: order.contact_id,
        },
      ];
      if (shipping.gt(0))
        lines.push({
          account_code: "4200",
          credit_ngn: toCurrencyString(shipping),
          description: "Shipping revenue",
        });
      if (tax.gt(0))
        lines.push({
          account_code: "2100",
          credit_ngn: toCurrencyString(tax),
          description: "VAT output",
        });
      if (cogs.gt(0)) {
        lines.push({
          account_code: "5000",
          debit_ngn: toCurrencyString(cogs),
          description: "Cost of goods sold",
        });
        lines.push({
          account_code: "1300",
          credit_ngn: toCurrencyString(cogs),
          description: "Inventory relief",
        });
      }

      await accounting.postEntry({
        brand,
        user_id: null,
        entry: {
          source_type: "sales",
          source_table: "sales_orders",
          source_id: order_id,
          reference: order.order_number,
          description: `Sale ${order.order_number}`,
        },
        lines,
      });
    } catch (err) {
      logger.error(
        { err: err.message, brand, order_id },
        "accounting: sale journal post failed",
      );
    }
  });

  logger.info("accounting subscribers registered (sales.order.paid → GL post)");
}

register();

module.exports = { register };
