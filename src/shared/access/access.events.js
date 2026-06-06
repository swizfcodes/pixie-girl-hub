/**
 * Access (RBAC admin) domain events. Mirrors the module event pattern:
 * small payloads (IDs + brand), subscribers re-query for detail. These feed
 * real-time access-change notices and the audit trail's extra context.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  const fullType = `access.${eventType}`;
  try {
    emitter.emit(fullType, payload);
    emitter.emit("*", { type: fullType, payload });
  } catch (err) {
    logger.error({ err, eventType: fullType }, "access event emit failed");
  }
}

function on(eventType, handler) {
  emitter.on(`access.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
