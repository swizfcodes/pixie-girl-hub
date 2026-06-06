/**
 * Contacts (V2.2 §6.12) — domain events. CRM/Sales/Smartcomm subscribe.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`contacts.${eventType}`, payload);
    emitter.emit("*", { type: `contacts.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "contacts event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`contacts.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
