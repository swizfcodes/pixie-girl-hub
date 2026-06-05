/**
 * Money & currency helpers.
 *
 * Rules (V2.2 §5.1):
 *   - Base currency is NGN.
 *   - All persisted amounts in NGN are NUMERIC(14,2). Always use Decimal.
 *   - Customer-facing display in NGN/USD/GBP/EUR/CAD/GHS per IP.
 *   - FX rates buffered and refreshed on a schedule (config in business_setup).
 *
 * NEVER use plain JS Number arithmetic for money. Always Decimal.
 */

"use strict";

const Decimal = require("decimal.js");

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const SUPPORTED_CURRENCIES = new Set([
  "NGN",
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "GHS",
]);

/**
 * Parse a money value (string, number, or Decimal) safely.
 * Throws on NaN.
 */
function money(value) {
  if (value === null || value === undefined) {
    throw new TypeError("money(): null/undefined");
  }
  const d = new Decimal(value);
  if (!d.isFinite()) throw new TypeError(`money(): non-finite value ${value}`);
  return d;
}

/**
 * Round to 2dp using ROUND_HALF_UP and return a string ready for SQL.
 */
function toCurrencyString(value) {
  return money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/**
 * Apply charm rounding to a published price (V2.2 §6.25).
 * Rounds UP to the next .99 (NGN: rounds to next 100, then subtracts 1).
 *
 * @param {string|number|Decimal} amount
 * @param {'NGN'|'USD'|'GBP'|'EUR'|'CAD'|'GHS'} currency
 */
function charmRound(amount, currency) {
  const d = money(amount);
  switch (currency) {
    case "NGN": {
      // Round UP to next thousand minus 100. e.g. 119,001 → 119,900
      const k = d.dividedBy(1000).ceil().times(1000).minus(100);
      return k.toDecimalPlaces(2, Decimal.ROUND_UP);
    }
    case "USD":
    case "CAD":
    case "GHS": {
      // Round UP to next .99. e.g. 74.32 → 74.99
      const floor = d.floor();
      return floor.plus("0.99").toDecimalPlaces(2, Decimal.ROUND_UP);
    }
    case "GBP":
    case "EUR": {
      // Round UP to next .95 (Eurozone convention)
      const floor = d.floor();
      return floor.plus("0.95").toDecimalPlaces(2, Decimal.ROUND_UP);
    }
    default:
      return d.toDecimalPlaces(2, Decimal.ROUND_UP);
  }
}

/**
 * Gross up a net target through a gateway fee schedule (V2.2 §6.25).
 *   gross = (net + fixed_fee) / (1 - pct_fee)
 *
 * @param {Decimal|string|number} net
 * @param {{ pct: number|string, fixed: number|string, cap?: number|string }} feeSchedule
 * @returns {Decimal} gross
 */
function grossUpForGatewayFee(net, feeSchedule) {
  const netD = money(net);
  const pct = money(feeSchedule.pct);
  const fixed = money(feeSchedule.fixed || 0);
  if (pct.gte(1)) throw new Error("Gateway fee pct must be < 1");

  const denom = new Decimal(1).minus(pct);
  const raw = netD.plus(fixed).dividedBy(denom);

  if (feeSchedule.cap) {
    // If the implied fee on `raw` exceeds the cap, recompute with capped fee
    const cap = money(feeSchedule.cap);
    const impliedFee = raw.minus(netD);
    if (impliedFee.gt(cap)) {
      return netD.plus(cap);
    }
  }
  return raw;
}

function isSupportedCurrency(code) {
  return (
    typeof code === "string" && SUPPORTED_CURRENCIES.has(code.toUpperCase())
  );
}

module.exports = {
  Decimal,
  SUPPORTED_CURRENCIES,
  money,
  toCurrencyString,
  charmRound,
  grossUpForGatewayFee,
  isSupportedCurrency,
};
