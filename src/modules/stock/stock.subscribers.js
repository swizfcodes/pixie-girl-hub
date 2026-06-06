/**
 * Stock subscribers — wires cross-module SSOT reactions.
 * On catalogue `variant.created`, seed a zero stock_levels row at the
 * brand's default location so the variant is immediately trackable.
 * Registered once (side-effect on require).
 */

"use strict";

const catalogue = require("../catalogue/catalogue.events");
const repo = require("./stock.repo");
const { logger } = require("../../config/logger");

let registered = false;

function register() {
  if (registered) return;
  registered = true;
  catalogue.on("variant.created", async ({ brand, variant_id }) => {
    try {
      const loc = await repo.getDefaultLocation({ brand });
      if (loc)
        await repo.seedLevel({
          brand,
          variant_id,
          location_id: loc.location_id,
        });
    } catch (err) {
      logger.error(
        { err: err.message, brand, variant_id },
        "stock seed on variant.created failed",
      );
    }
  });
  logger.info(
    "stock subscribers registered (catalogue.variant.created → seed level)",
  );
}

register();

module.exports = { register };
