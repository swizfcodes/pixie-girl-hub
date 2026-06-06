/**
 * CRM (V2.2 §6.1) — domain events. `deal.won` is consumed by Sales.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`crm.${eventType}`, payload);
    emitter.emit("*", { type: `crm.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "crm event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`crm.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
