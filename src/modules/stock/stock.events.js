/**
 * Stock (V2.2 §6.9) — domain events. `stock.moved` feeds realtime + low-stock.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`stock.${eventType}`, payload);
    emitter.emit("*", { type: `stock.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "stock event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`stock.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
