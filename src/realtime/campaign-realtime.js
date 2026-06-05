/**
 * Campaign real-time relay.
 *
 * Subscribes to sales_campaigns domain events and broadcasts them into the
 * canonical room brand:{brand}:campaign:{id}. Per ARCHITECTURE.md, modules
 * emit domain events; this relay (not the controller/service) talks to
 * Socket.io. Registered once during socket init.
 */

"use strict";

const events = require("../modules/sales_campaigns/campaigns.events");
const { ROOMS } = require("./rooms");
const { getIo } = require("../config/socket");
const { logger } = require("../config/logger");

function emitToRoom(brand, id, channel, payload) {
  if (!brand || !id) return;
  try {
    getIo().to(ROOMS.campaign_live(brand, id)).emit(channel, payload);
  } catch (err) {
    // Socket.io may not be initialised (e.g. worker process / tests).
    logger.debug({ err: err.message }, "campaign realtime emit skipped");
  }
}

function registerCampaignRealtime() {
  events.on("metrics_updated", ({ brand, id, metrics }) =>
    emitToRoom(brand, id, "campaign:metrics", metrics),
  );
  for (const evt of ["launch", "pause", "resume", "end", "approved"]) {
    events.on(evt, ({ brand, id, status }) =>
      emitToRoom(brand, id, `campaign:${evt}`, { status }),
    );
  }
  logger.info("campaign realtime relay registered");
}

module.exports = { registerCampaignRealtime };
