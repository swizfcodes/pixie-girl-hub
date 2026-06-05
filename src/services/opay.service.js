/**
 * Opay gateway client (V2.2 §6.21).
 * Local NGN gateway. Primary or fallback to Paystack.
 */

"use strict";

const axios = require("axios");
const { config } = require("../config/env");

const client = axios.create({
  baseURL: "https://liveapi.opaycheckout.com",
  headers: { Authorization: `Bearer ${config.OPAY_PRIVATE_KEY}` },
});

async function initializePayment({
  amount,
  reference,
  callback_url,
  customer,
}) {
  // TODO: implement per Opay API spec
  throw new Error("TODO: implement Opay initializePayment");
}

module.exports = { initializePayment };
