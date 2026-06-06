/**
 * Sales (V2.2 §6.2) — domain events.
 * `order.paid` is the cross-module trigger consumed by Invoicing (raise
 * invoice) and Accounting (post revenue journal entry).
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`sales.${eventType}`, payload);
    emitter.emit("*", { type: `sales.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "sales event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`sales.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
