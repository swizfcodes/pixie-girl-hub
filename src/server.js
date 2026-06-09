/**
 * Pixie Girl Hub — Backend Server Entry Point
 *
 * Responsibilities:
 *   - Load environment & validate
 *   - Initialise DB pool, Redis, Socket.io
 *   - Mount routes
 *   - Bind global middleware
 *   - Start HTTP server + workers
 *
 * Process lifecycle:
 *   - SIGTERM/SIGINT → graceful shutdown (drain connections, close pool, flush logs)
 */

"use strict";

require("dotenv").config();
require("express-async-errors");

const http = require("http");
const express = require("express");

const { config, validateEnv } = require("./config/env");
const { logger } = require("./config/logger");
const { initDatabase, closeDatabase } = require("./config/database");
const { refreshBrands } = require("./config/brands");
const { initRedis, closeRedis } = require("./config/redis");
const { initSocketIo, closeSocketIo } = require("./config/socket");

const { applyGlobalMiddleware } = require("./middleware");
const { mountRoutes } = require("./routes");
const { startWorkers, stopWorkers } = require("./jobs/worker");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");

async function bootstrap() {
  // ── Validate environment first; fail fast ──────────────
  validateEnv();
  logger.info({ env: config.NODE_ENV }, "starting pixiegirl-hub-backend");

  // ── Initialise external connections ────────────────────
  await initDatabase();
  logger.info("database connected");

  // ── Load the brand registry from business_config (W-11) ─
  // Must come after the DB pool is up and before requests/crons so every
  // per-brand guard sees the full, current set of brands.
  await refreshBrands();

  await initRedis();
  logger.info("redis connected");

  // ── Build Express app ──────────────────────────────────
  const app = express();
  applyGlobalMiddleware(app);
  mountRoutes(app);
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ── Wrap in HTTP server so we can attach Socket.io ─────
  const server = http.createServer(app);
  await initSocketIo(server);
  logger.info("socket.io ready");

  // ── Start background workers (queues + cron) ───────────
  if (config.ENABLE_WORKERS) {
    await startWorkers();
    logger.info("workers started");
  }

  // ── Listen ─────────────────────────────────────────────
  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "server listening");
  });

  // ── Graceful shutdown ──────────────────────────────────
  const shutdown = async (signal) => {
    logger.warn({ signal }, "shutdown requested");
    server.close(() => logger.info("http server closed"));
    await stopWorkers().catch((e) => logger.error(e, "worker stop failed"));
    await closeSocketIo().catch((e) =>
      logger.error(e, "socket.io close failed"),
    );
    await closeRedis().catch((e) => logger.error(e, "redis close failed"));
    await closeDatabase().catch((e) =>
      logger.error(e, "database close failed"),
    );
    logger.info("shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ── Crash-safety ───────────────────────────────────────
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaught exception");
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "unhandled rejection");
    shutdown("unhandledRejection");
  });
}

bootstrap().catch((err) => {
  /// eslint-disable-next-line no-console
  console.error("Fatal bootstrap error:", err);
  process.exit(1);
});
