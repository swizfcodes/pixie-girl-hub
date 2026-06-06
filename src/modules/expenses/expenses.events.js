/**
 * Expense Management (V2.2 §6.7) — domain events.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`expenses.${eventType}`, payload);
    emitter.emit("*", { type: `expenses.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "expenses event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`expenses.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
