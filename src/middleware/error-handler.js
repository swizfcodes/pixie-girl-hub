/**
 * Centralised error handler.
 *
 * Sends a consistent error shape to clients:
 *   { error: { code, message, fields? }, request_id }
 *
 * Never leaks SQL errors, stack traces, or internal messages.
 * Validation errors (Zod/Joi) get 400 with field-level details.
 */

"use strict";

const { ZodError } = require("zod");
const { logger } = require("../config/logger");
const { AppError } = require("../utils/errors");

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found" },
    request_id: req.request_id,
  });
}

// 4-arg signature is required for Express to recognise this as error handler
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const request_id = req.request_id;

  if (err instanceof AppError) {
    logger.warn(
      {
        request_id,
        code: err.code,
        http: err.http_status,
        user: req.user?.user_id,
      },
      err.message,
    );
    return res.status(err.http_status).json({
      error: {
        code: err.code,
        message: err.user_message || err.message,
        fields: err.fields,
      },
      request_id,
    });
  }

  if (err instanceof ZodError) {
    const fields = err.issues.reduce((acc, i) => {
      const path = i.path.join(".");
      if (!acc[path]) acc[path] = [];
      acc[path].push(i.message);
      return acc;
    }, {});
    logger.warn({ request_id, fields }, "validation error");
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", fields },
      request_id,
    });
  }

  // PG unique-violation / fk-violation surface as code-only — never raw message
  if (err.code === "23505") {
    logger.warn({ request_id, constraint: err.constraint }, "unique violation");
    return res.status(409).json({
      error: {
        code: "CONFLICT",
        message: "A record with these values already exists",
      },
      request_id,
    });
  }
  if (err.code === "23503") {
    logger.warn({ request_id, constraint: err.constraint }, "fk violation");
    return res.status(409).json({
      error: {
        code: "REFERENCE_INVALID",
        message: "Referenced record not found",
      },
      request_id,
    });
  }
  if (err.code === "23514") {
    logger.warn({ request_id, constraint: err.constraint }, "check violation");
    return res.status(400).json({
      error: {
        code: "INVALID_VALUE",
        message: "A value violates a domain constraint",
      },
      request_id,
    });
  }

  // Fallthrough — unexpected
  logger.error({ err, request_id }, "unhandled error");
  return res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An internal error occurred" },
    request_id,
  });
}

module.exports = { errorHandler, notFoundHandler };
