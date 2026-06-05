/**
 * Purchasing & Imports (V2.2 §6.8)
 * Domain events emitted by the service layer.
 *
 * These feed:
 *   - Socket.io real-time updates (via realtime/handlers)
 *   - Audit log (already written separately, but events get extra context)
 *   - AI Insights triggers
 *   - Workflow engine (some events open workflow instances)
 *
 * Use a simple emitter — keep payloads small (just IDs + brand), let
 * subscribers re-query if they need the full record.
 */

"use strict";

const { EventEmitter } = require("events");
const { logger } = require("../../config/logger");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

function emit(eventType, payload) {
  const fullType = `purchasing.${eventType}`;
  try {
    emitter.emit(fullType, payload);
    emitter.emit("*", { type: fullType, payload });
  } catch (err) {
    logger.error({ err, eventType: fullType }, "purchasing event emit failed");
  }
}

function on(eventType, handler) {
  emitter.on(`purchasing.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
