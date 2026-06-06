/**
 * Catalogue (V2.2 §6.4 / §6.9) — domain events.
 * `variant.created` is consumed by Stock to seed a stock_levels row (SSOT).
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`catalogue.${eventType}`, payload);
    emitter.emit("*", { type: `catalogue.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "catalogue event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`catalogue.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
