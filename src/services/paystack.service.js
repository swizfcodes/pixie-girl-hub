/**
 * Paystack gateway client (V2.2 §5.1, §6.21).
 * Local NGN gateway. Paired with Opay as primary/fallback.
 */

"use strict";

const axios = require("axios");
const { config } = require("../config/env");

const client = axios.create({
  baseURL: "https://api.paystack.co",
  headers: { Authorization: `Bearer ${config.PAYSTACK_SECRET_KEY}` },
});

async function initializeTransaction({
  email,
  amount_kobo,
  reference,
  callback_url,
  metadata,
}) {
  const { data } = await client.post("/transaction/initialize", {
    email,
    amount: amount_kobo,
    reference,
    callback_url,
    metadata,
  });
  return data;
}

async function verifyTransaction(reference) {
  const { data } = await client.get(`/transaction/verify/${reference}`);
  return data;
}

module.exports = { initializeTransaction, verifyTransaction };
