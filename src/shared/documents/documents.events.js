/**
 * Documents (V2.2 §6.13) — domain events.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  try {
    emitter.emit(`documents.${eventType}`, payload);
    emitter.emit("*", { type: `documents.${eventType}`, payload });
  } catch (err) {
    logger.error({ err, eventType }, "documents event emit failed");
  }
}
function on(eventType, handler) {
  emitter.on(`documents.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
