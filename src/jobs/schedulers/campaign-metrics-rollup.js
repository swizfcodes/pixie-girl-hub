/**
 * Campaign metrics rollup (V2.2 §6.22 real-time dashboard).
 * Runs every 5 minutes: recomputes rollups + an hourly snapshot for every
 * live campaign and broadcasts on brand:{brand}:campaign:{id}.
 */

"use strict";

const { logger } = require("../../config/logger");
const analytics = require("../../modules/sales_campaigns/campaigns.analytics.service");

async function runCampaignMetricsRollup() {
  const count = await analytics.rollupAllLive();
  if (count) logger.debug({ count }, "campaign metrics rolled up");
}

module.exports = { runCampaignMetricsRollup };
