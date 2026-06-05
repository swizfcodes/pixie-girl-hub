# Architecture Overview

## Big picture

Pixie Girl Hub is a **single Node.js backend serving two Nigerian companies** (Pixie Girl Global + Faitlynhair) from one codebase, with their data deliberately isolated at the database level. The frontend admin sees one product; the database keeps two clean sets of books.

## Stack

| Layer           | Technology                                                                  |
| --------------- | --------------------------------------------------------------------------- |
| Runtime         | Node.js 20                                                                  |
| Framework       | Express 4                                                                   |
| Database        | PostgreSQL 16 + pgvector                                                    |
| Cache & queue   | Redis 7 (BullMQ + sessions + rate-limit)                                    |
| Real-time       | Socket.io 4 with Redis adapter                                              |
| Auth            | JWT (15-min access + 14-day refresh, rotated)                               |
| Validation      | Zod                                                                         |
| Logging         | Pino                                                                        |
| Background jobs | BullMQ + node-cron                                                          |
| AI              | DeepSeek (LLM) + Groq Whisper (transcription) + OpenAI embeddings (RAG)     |
| File storage    | Local FS + FFmpeg (self-hosted per V2.2 spec; CDN in front)                 |
| Payments        | Paystack + Opay (primary/fallback NGN), Nomba (POS), Stripe (international) |

## Layout

```
src/
├── server.js                ← single entry point
├── config/                  ← env, db pool, redis, socket setup
├── middleware/              ← global: auth, RBAC, brand context, error handler
├── routes/                  ← top-level route mounting
├── modules/                 ← 37 modules, each self-contained (V2.2 §6.1-6.32 + auth)
│   └── <module>/
│       ├── <mod>.routes.js     Express router
│       ├── <mod>.controller.js HTTP handlers
│       ├── <mod>.service.js    business logic + transactions + events
│       ├── <mod>.repo.js       parameterised SQL only
│       ├── <mod>.validator.js  Zod input schemas
│       ├── <mod>.events.js     EventEmitter for domain events
│       └── README.md
├── services/                ← cross-module helpers (storage, email, WhatsApp, etc.)
├── ai/                      ← Praxis orchestrator, RAG, action catalogue, usage meter
├── workflows/               ← workflow engine (Module 6.27)
├── realtime/                ← Socket.io rooms + handlers
├── jobs/                    ← workers (queues + cron schedulers)
└── utils/                   ← money, dates, errors, pagination
```

## Data architecture

Three schemas in one database:

```
shared.*          107 tables   Cross-brand identity, contacts, intercompany,
                               audit, AI tables, storefront content shared by brand
pixiegirl.*       159 tables   PXG brand-specific data
faitlynhair.*     159 tables   FLH brand-specific data
```

**Total: 425 tables.** Each per-brand schema is identical in structure but completely separate in data. Schema-per-business is the primary isolation mechanism; RLS on the shared schema is pending (see CONFORMANCE_GAPS.md).

## Request lifecycle (typical authenticated API call)

```
HTTP request
  │
  ▼
applyGlobalMiddleware    helmet, cors, compression, request-id, request log
  │
  ▼
authMiddleware           JWT verify → req.user
  │
  ▼
brandContextMiddleware   X-Brand-Context header → req.brand (pixiegirl|faitlynhair)
                         Verifies user has access to that brand
  │
  ▼
requirePermission        Looks up shared.permissions; sets req.permission_scope
                         CEO bypasses
  │
  ▼
validator.validate*      Zod schema parses + transforms req.body
  │
  ▼
controller.x             Pulls req fields, calls service
  │
  ▼
service.x                Business logic:
                         - opens transaction
                         - calls repo
                         - emits events (Socket.io + AI + audit)
                         - writes audit_log
                         - commits / rollback
  │
  ▼
repo.x                   Parameterised SQL only (pixiegirl.foo or shared.foo)
                         Honours scope: 'all' / 'team' / 'own'
  │
  ▼
events.emit(...)         → Socket.io rooms (brand:X:resource)
                         → AI Insights subscribers
                         → workflow engine triggers (where applicable)
  │
  ▼
JSON response            { data: ... } or { error: { code, message }, request_id }
```

## Concurrency model

- **Single Node.js process** per dyno (no cluster mode — let Kubernetes/PM2 scale horizontally)
- **DB connections pooled** (min 2, max 20 per dyno; tune in env)
- **Redis pub/sub** is what lets multiple API dynos share Socket.io rooms
- **Background work** runs in dedicated worker dynos (`ENABLE_WORKERS=true`); the API dyno can also run workers locally in dev

## Real-time

Socket.io rooms drive live updates. See `src/realtime/rooms.js` for the canonical list. Frontend mirrors this list.

The single most important pattern: **events.js in each module emits domain events; Socket.io is one subscriber, AI Insights is another, audit is a third.** Controllers never emit to Socket.io directly — that breaks composability.

## Security highlights

1. **JWT rotation** — refresh tokens are single-use, stored in Redis by jti, revocable
2. **Argon2** for password hashing (V2.2 standard)
3. **AES-256-GCM** for credentials at rest (Paystack secret, social tokens, etc.)
4. **Audit log is append-only** at the DB level (UPDATE/DELETE blocked by trigger)
5. **Permission checks server-side per request** — frontend hints don't matter
6. **AI is permission-inheriting** — Praxis can only do what the user can do
7. **Webhook signature verification** before any side effect

## Testing strategy

- **Unit tests** for pure functions (utils, validators, money math)
- **Integration tests** spin up Postgres + Redis (testcontainers) and run real SQL
- **End-to-end tests** are minimal — focus on critical flows (place order, run payroll, raise intercompany invoice)
- Aim for **70%+ coverage on services + repos**, less on controllers (they're thin)

## Deployment

- Single Dockerfile, two targets (`runtime`, `worker`)
- `docker-compose.yml` for local dev
- Production: separate API service (web dyno) and Worker service (worker dyno)
- DB migrations run as a one-shot pre-deploy job; never auto on app boot

## What's NOT in the codebase

- No ORM (Sequelize/Prisma/etc.) — we want SQL control
- No NestJS — flat modules per V2.2 §8
- No GraphQL — REST throughout
- No microservices — monolith with clear module boundaries
- No frontend code — this is backend only
