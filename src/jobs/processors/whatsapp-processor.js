/**
 * BullMQ processor: whatsapp-processor
 *
 * Expected payload shape and side-effects documented in src/jobs/worker.js
 * Concurrency is set there (default 4).
 */

"use strict";

const { logger } = require("../../config/logger");

module.exports = async function process(job) {
  logger.info(
    { jobId: job.id, queue: "whatsapp-processor", data: job.data },
    "processing job",
  );
  // TODO: implement
};
