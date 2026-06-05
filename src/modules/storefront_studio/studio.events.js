/**
 * Storefront Studio (V2.2 §6.28)
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
  const fullType = `storefront_studio.${eventType}`;
  try {
    emitter.emit(fullType, payload);
    emitter.emit("*", { type: fullType, payload });
  } catch (err) {
    logger.error(
      { err, eventType: fullType },
      "storefront_studio event emit failed",
    );
  }
}

function on(eventType, handler) {
  emitter.on(`storefront_studio.${eventType}`, handler);
}

module.exports = { emit, on, emitter };
