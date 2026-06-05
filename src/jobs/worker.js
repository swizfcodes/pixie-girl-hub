/**
 * Background worker — BullMQ queues + cron schedules.
 *
 * Started in-process by `src/server.js` when ENABLE_WORKERS=true,
 * or independently by `npm run workers:start` for a dedicated worker
 * dyno in production.
 *
 * Queues:
 *   media-processing   — FFmpeg compress, poster gen
 *   email-send         — outbound transactional + campaign emails
 *   whatsapp-send      — Smartcomm outbound WA messages
 *   webhooks-replay    — failed inbound webhook retries
 *   ai-embed           — RAG ingest jobs
 *   report-generate    — weekly Sales + Customer reports (V2.2 §6.30)
 *
 * Cron jobs (timezone Africa/Lagos):
 *   daily 07:00      — AI Briefing
 *   daily 02:00      — Layaway abandonment check (V2.2 §6.2 — auto-cancel 60d)
 *   Sat 20:00        — Weekly Sales & Customer Reports
 *   daily 06:00      — FX rate refresh
 *   twice/day        — Low-stock alerts
 *   every 15m        — Pending action expiry sweep (Praxis)
 *   every 30m        — Layaway gentle payment reminder
 */

"use strict";

const cron = require("node-cron");
const { Queue, Worker } = require("bullmq");
const { config } = require("../config/env");
const { logger } = require("../config/logger");
const { getClient: getRedisClient } = require("../config/redis");

const queueNames = [
  "media-processing",
  "email-send",
  "whatsapp-send",
  "webhooks-replay",
  "ai-embed",
  "report-generate",
];

const queues = new Map();
const workers = [];
const cronJobs = [];

function getQueue(name) {
  if (!queues.has(name)) throw new Error(`queue ${name} not initialised`);
  return queues.get(name);
}

async function startWorkers() {
  const connection = getRedisClient();

  // Initialise queues
  for (const name of queueNames) {
    queues.set(name, new Queue(name, { connection }));
  }

  // Workers — each pulls in its processor lazily
  const handlers = {
    "media-processing": require("./processors/media-processor"),
    "email-send": require("./processors/email-processor"),
    "whatsapp-send": require("./processors/whatsapp-processor"),
    "webhooks-replay": require("./processors/webhooks-replay-processor"),
    "ai-embed": require("./processors/ai-embed-processor"),
    "report-generate": require("./processors/report-processor"),
  };

  for (const [name, processor] of Object.entries(handlers)) {
    const worker = new Worker(name, processor, { connection, concurrency: 4 });
    worker.on("failed", (job, err) =>
      logger.error({ queue: name, jobId: job?.id, err }, "job failed"),
    );
    worker.on("completed", (job) =>
      logger.debug({ queue: name, jobId: job?.id }, "job completed"),
    );
    workers.push(worker);
  }

  // ── Cron schedules ─────────────────────────────────────
  const scheduleCron = (name, expr, fn) => {
    const job = cron.schedule(
      expr,
      async () => {
        try {
          await fn();
        } catch (err) {
          logger.error({ err, cron: name }, "cron job failed");
        }
      },
      { timezone: config.TZ },
    );
    cronJobs.push({ name, job });
    logger.info({ cron: name, expr }, "cron scheduled");
  };

  const { runDailyAiBriefing } = require("./schedulers/ai-briefing");
  const {
    runWeeklySalesReport,
    runWeeklyCustomerReport,
  } = require("./schedulers/weekly-reports");
  const {
    runLayawayAbandonmentSweep,
  } = require("./schedulers/layaway-abandonment");
  const { runFxRateRefresh } = require("./schedulers/fx-rates");
  const { runLowStockAlerts } = require("./schedulers/low-stock");
  const {
    runPendingActionExpirySweep,
  } = require("./schedulers/ai-pending-expiry");
  const { runLayawayReminders } = require("./schedulers/layaway-reminders");
  const {
    runCampaignStateTransitions,
  } = require("./schedulers/campaign-state-transition");
  const {
    runCampaignMetricsRollup,
  } = require("./schedulers/campaign-metrics-rollup");

  scheduleCron("daily-ai-briefing", "0 7 * * *", runDailyAiBriefing);
  scheduleCron("weekly-sales-report", "0 20 * * 6", runWeeklySalesReport);
  scheduleCron("weekly-customer-report", "0 20 * * 6", runWeeklyCustomerReport);
  scheduleCron("layaway-abandonment", "0 2 * * *", runLayawayAbandonmentSweep);
  scheduleCron("fx-rate-refresh", "0 6 * * *", runFxRateRefresh);
  scheduleCron("low-stock-alerts", "0 8,14 * * *", runLowStockAlerts);
  scheduleCron(
    "ai-pending-expiry",
    "*/15 * * * *",
    runPendingActionExpirySweep,
  );
  scheduleCron("layaway-reminders", "*/30 * * * *", runLayawayReminders);
  scheduleCron(
    "campaign-state-transition",
    "* * * * *",
    runCampaignStateTransitions,
  );
  scheduleCron("campaign-metrics-rollup", "*/5 * * * *", runCampaignMetricsRollup);
}

async function stopWorkers() {
  for (const { job } of cronJobs) job.stop();
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled([...queues.values()].map((q) => q.close()));
  queues.clear();
  workers.length = 0;
  cronJobs.length = 0;
}

module.exports = { startWorkers, stopWorkers, getQueue };
