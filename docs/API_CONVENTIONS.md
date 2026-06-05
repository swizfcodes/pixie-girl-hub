# API Conventions

This document is the contract between frontend and backend. Stick to it.

## Base URL

```
https://api.pixiegirlhub.com/api/v1/...   (production)
http://localhost:3000/api/v1/...           (development)
```

Public, no-auth endpoints live under `/api/public/...`
Webhook receivers live under `/api/webhooks/...`

## Headers

| Header                                    | When                     | Notes                       |
| ----------------------------------------- | ------------------------ | --------------------------- |
| `Authorization: Bearer <jwt>`             | All authenticated routes | 15-min access token         |
| `X-Brand-Context: pixiegirl\|faitlynhair` | All `/api/v1/*` routes   | Which entity to operate on  |
| `X-Request-Id: <uuid>`                    | Optional                 | Echoed back; correlate logs |
| `Content-Type: application/json`          | All POST/PATCH/PUT       |                             |

## Response shape

### Success

```json
{
  "data": { ... } | [ ... ],
  "meta": { "page": 1, "page_size": 25, "total": 138 }   // for list endpoints
}
```

### Error

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 2 units of variant 12345 in stock",
    "fields": { "quantity": ["Cannot exceed available stock"] } // for validation errors
  },
  "request_id": "01JAB7..."
}
```

## Status codes

| Code | Meaning               | When                                             |
| ---- | --------------------- | ------------------------------------------------ |
| 200  | OK                    | Successful GET/PATCH                             |
| 201  | Created               | Successful POST that creates a resource          |
| 204  | No Content            | Successful DELETE/archive                        |
| 400  | Bad Request           | Validation error, invalid body                   |
| 401  | Unauthorized          | Missing/invalid/expired JWT                      |
| 402  | Payment Required      | AI budget exhausted                              |
| 403  | Forbidden             | Authenticated but not permitted                  |
| 404  | Not Found             | Resource doesn't exist (or user can't see it)    |
| 409  | Conflict              | Duplicate, FK violation, business-rule violation |
| 422  | Unprocessable Entity  | Reserved — use 400 with `fields` for validation  |
| 423  | Locked                | User account locked                              |
| 429  | Too Many Requests     | Rate limit exceeded                              |
| 500  | Internal Server Error | Unexpected; logged with request_id               |
| 503  | Service Unavailable   | AI feature disabled, downstream gateway down     |

## Standard error codes

| Code                     | HTTP | Use                                           |
| ------------------------ | ---- | --------------------------------------------- |
| `VALIDATION_ERROR`       | 400  | Input failed schema validation (see `fields`) |
| `INVALID_VALUE`          | 400  | A field violated a domain rule                |
| `AUTH_REQUIRED`          | 401  | Missing Authorization header                  |
| `INVALID_TOKEN`          | 401  | JWT malformed or invalid signature            |
| `TOKEN_EXPIRED`          | 401  | Access token past expiry — refresh            |
| `TOKEN_REVOKED`          | 401  | Refresh token revoked — login again           |
| `USER_INACTIVE`          | 401  | Account inactive                              |
| `USER_LOCKED`            | 423  | Too many failed logins; admin must unlock     |
| `PERMISSION_DENIED`      | 403  | RBAC check failed                             |
| `BRAND_ACCESS_DENIED`    | 403  | User can't act on this brand                  |
| `BRAND_CONTEXT_REQUIRED` | 400  | X-Brand-Context header missing                |
| `NOT_FOUND`              | 404  | Resource doesn't exist                        |
| `CONFLICT`               | 409  | Unique-constraint violation                   |
| `REFERENCE_INVALID`      | 409  | FK references a non-existent record           |
| `WORKFLOW_REQUIRED`      | 409  | Action requires approval workflow             |
| `INSUFFICIENT_STOCK`     | 409  | Stock check failed                            |
| `AI_FEATURE_DISABLED`    | 503  | The AI capability is turned off               |
| `AI_BUDGET_EXHAUSTED`    | 402  | Monthly hard cap reached                      |
| `NOT_IMPLEMENTED`        | 501  | Endpoint is stubbed                           |
| `INTERNAL_ERROR`         | 500  | Unexpected — check logs by request_id         |

## Pagination

All list endpoints accept:

- `?page=1` (1-indexed, default 1)
- `?page_size=25` (default 25, max 100)
- `?sort=field:asc|desc` (optional, default `created_at:desc`)
- `?<field>=value` (filter — module-specific)

Response includes `meta` with `page`, `page_size`, `total`, `has_more`.

## Money

- All monetary values in JSON are **strings** with 2 decimal places: `"45000.00"`
- The currency is `NGN` unless the payload explicitly specifies otherwise
- Frontend must use a Decimal library — never plain JS Number arithmetic
- Conversions and display formatting happen frontend-side from base NGN + FX rate

## IDs

- All IDs are UUIDv4 strings: `"01JABF7K..."`
- The exception: document numbers (`PXG-INV-0001`, `FLH-SO-0042`) are human-readable strings, separate from the UUID. Both are returned.

## Dates & times

- Timestamps in ISO 8601 with UTC offset: `"2026-05-27T10:23:45.123Z"`
- Date-only (no time) as `"YYYY-MM-DD"`
- Frontend converts to the user's locale; default is `Africa/Lagos`

## Versioning

URL versioning: `/api/v1/...`
We commit to no breaking changes within v1. New fields can be added; existing fields may not change shape or be removed. Major changes go to `/api/v2`.

## Idempotency

For POST endpoints that create resources affected by network retries (payments, POS transactions, deliveries), the request body should include `client_idempotency_key`. The server will return the original response if the key has been seen — never create twice.

Headers approach: `Idempotency-Key: <uuid>` is also accepted for cross-cutting use.

## Real-time

Socket.io is connected after JWT auth. The client joins rooms by emitting `join` with a `{ room }` payload. The server validates room access against the user's brand and permissions before allowing the join.

See `src/realtime/rooms.js` for the canonical room list.

## Webhooks (inbound)

The backend exposes signed webhook endpoints under `/api/webhooks/<provider>`. Each provider has its own signature header and secret (configured in `business_setup`). The endpoint:

1. Returns 200/204 fast (within 1 second)
2. Persists the raw payload to `shared.webhook_log`
3. Enqueues processing on the `webhooks-replay` queue if needed

Never block the response on heavy processing.
