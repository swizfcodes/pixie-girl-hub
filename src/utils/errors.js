/**
 * Application errors. Use AppError for any business-rule violation.
 *
 *   throw new AppError('INSUFFICIENT_STOCK', 'Only 2 units left', 409);
 *
 * The error handler in middleware/error-handler.js translates these
 * into JSON responses. Stack traces never reach the client.
 */

"use strict";

class AppError extends Error {
  /**
   * @param {string} code           Machine-readable code (SCREAMING_SNAKE_CASE).
   * @param {string} message        Internal/log message.
   * @param {number} http_status    HTTP status to return (default 400).
   * @param {object} [extra]        Optional details.
   * @param {object} [extra.fields] Field-level error map.
   * @param {string} [extra.user_message] Customer-facing message (overrides `message`).
   * @param {object} [extra.metadata] Anything else for logs.
   */
  constructor(code, message, http_status = 400, extra = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.http_status = http_status;
    this.user_message = extra.user_message || null;
    this.fields = extra.fields || null;
    this.metadata = extra.metadata || null;
    Error.captureStackTrace?.(this, AppError);
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super("NOT_FOUND", `${resource} not found`, 404);
  }
}

class PermissionDeniedError extends AppError {
  constructor(message = "Permission denied") {
    super("PERMISSION_DENIED", message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super("CONFLICT", message, 409);
  }
}

class ValidationError extends AppError {
  constructor(fields, message = "Validation failed") {
    super("VALIDATION_ERROR", message, 400, { fields });
  }
}

module.exports = {
  AppError,
  NotFoundError,
  PermissionDeniedError,
  ConflictError,
  ValidationError,
};
