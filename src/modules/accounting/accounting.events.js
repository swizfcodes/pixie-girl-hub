/**
 * Accounting & Finance (V2.2 §6.6) — domain events.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`accounting.${eventType}`, payload);
    emitter.emit("*", { type: `accounting.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "accounting event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`accounting.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
