/**
 * Invoicing & Billing (V2.2 §6.5) — domain events.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`invoicing.${eventType}`, payload);
    emitter.emit("*", { type: `invoicing.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "invoicing event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`invoicing.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
