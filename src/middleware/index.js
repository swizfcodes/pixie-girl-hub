/**
 * Global middleware setup. Order matters — applied in sequence.
 */

"use strict";

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");

const { config } = require("../config/env");
const { logger } = require("../config/logger");
const { requestIdMiddleware } = require("./request-id");

function applyGlobalMiddleware(app) {
  // Behind a proxy (nginx, etc.) — trust X-Forwarded-* headers
  app.set("trust proxy", 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // storefront has its own CSP via Next.js
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // CORS
  app.use(
    cors({
      origin: config.CORS_ORIGINS.split(",").filter(Boolean),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Brand-Context",
        "X-Request-Id",
      ],
    }),
  );

  app.use(compression());
  app.use(cookieParser(config.SESSION_SECRET));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.use(requestIdMiddleware);

  if (config.ENABLE_REQUEST_LOGGING) {
    app.use(
      pinoHttp({
        logger,
        customLogLevel(_req, res, err) {
          if (err || res.statusCode >= 500) return "error";
          if (res.statusCode >= 400) return "warn";
          return "info";
        },
        customSuccessMessage(req, res) {
          return `${req.method} ${req.url} → ${res.statusCode}`;
        },
        autoLogging: {
          ignore: (req) => req.url === "/health" || req.url === "/metrics",
        },
      }),
    );
  }

  // Global rate limit (per-route limits applied separately)
  app.use(
    "/api/",
    rateLimit({
      windowMs: 60_000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "TOO_MANY_REQUESTS",
        message: "Slow down — try again in a minute.",
      },
    }),
  );
}

module.exports = { applyGlobalMiddleware };
