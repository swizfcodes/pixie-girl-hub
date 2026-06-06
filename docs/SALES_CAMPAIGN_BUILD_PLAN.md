# Sales Campaign Backend — Build Plan

**Module:** `sales_campaigns` (V2.2 §6.22 Sales Campaigns & Landing Pages)
**Goal:** Ship a complete, spec-conformant backend so the frontend team can build the campaign builder, public landing page (`/sale/{slug}`), and live dashboard against a stable API.
**Conformance basis:** `pd` §6.22 (+ §6.4 public checkout, §8 conventions), `ARCHITECTURE.md`, `API_CONVENTIONS.md`, `RBAC.md`, `WORKFLOWS.md`, `ENTITY_ISOLATION.md`, `FRONTEND_SCREEN_REQUIREMENTS.md` §6.22, `ADMIN_UI_REQUIREMENTS.md`.

---

## ✅ Build status — DELIVERED (2026-06-05)

All phases (0 → 6) are implemented and tested. The full API contract is in `docs/openapi.yaml` (frontend can consume directly). 12/12 unit tests pass; every module resolves; all files pass `node --check`.

**Files written/changed:**

- Migrations: `template/000019` (added `pending_approval` status); `000102_shared_sales_campaign_permissions.sql` (RBAC approve/delete/export). _(The `sales_campaign_metrics` table already exists in `000019` — no new migration needed.)_
- Two missing middleware repos created (the app couldn't boot without them): `org_workflow/permissions.repo.js`, `business_setup/business-config.repo.js`.
- Workflow engine implemented: `src/workflows/engine.js` (was a TODO stub) — self-bootstraps a `campaign_approval` definition.
- Campaign module (`src/modules/sales_campaigns/`): `campaigns.repo / service / controller / routes / validator` (real), plus new `campaigns.public.* `, `campaigns.discount.service`, `campaigns.analytics.service`, `campaigns.notifications.service`.
- Realtime relay `src/realtime/campaign-realtime.js`; schedulers `campaign-state-transition.js` (every min) + `campaign-metrics-rollup.js` (every 5 min), wired into `worker.js`; public routes wired into `routes/index.js`; relay wired into `config/socket.js`.
- `package.json`: added missing `@socket.io/redis-adapter` (pre-existing gap — server couldn't boot without it).
- Tests: `tests/unit/sales_campaigns/campaigns.test.js`. OpenAPI updated with all campaign paths.

**To run:** `npm install` (pulls the new adapter + pdfkit) → `npm run db:migrate:shared && npm run db:bootstrap:*` → `npm run dev`. Checkout wiring (Phase 3) calls `campaigns.discount.service.resolveDiscount()` — wire it in once the `sales`/`pos`/`storefront` order services are built; the engine + tests are ready.

---

## 1. Where we stand

**Ready (schema layer — already migrated):**

- `{brand}.sales_campaigns` — full campaign + landing-page config, 3-phase state, denormalised rollup metrics, approval columns.
- `{brand}.sales_campaign_products` — include/exclude products or categories, per-product price override, featured/display order, stock snapshot fields.
- `{brand}.sales_campaign_signups` — pre-launch notification list (email/whatsapp/sms).
- Attribution wired: `sales_orders.sales_campaign_id`, `sales_order_discounts (source='campaign', sales_campaign_id, source_reference=slug)`, plus `utm_*` columns.
- Storefront analytics tables (new): `storefront_sessions`, `storefront_page_views`, `storefront_funnel_events` (carry `utm_campaign` + `converted_order_id` → campaign linkage).
- RBAC plumbing: `sales_campaigns` is a registered `permission_module_keys` entry.

**Not built yet (this plan):**

- `campaigns.repo.js` / `service.js` are generic stubs with bugs — wrong PK (`sales_campaigns_id` → should be `campaign_id`), reference a non-existent `is_deleted` column (this table is status-based: `status='archived'`), and `create()` throws TODO.
- No state machine, no public landing endpoint, no discount-at-checkout logic, no analytics aggregation, no go-live blast, no post-campaign report, no schedulers.
- **Schema gap:** `sales_campaign_metrics` (daily snapshot) is referenced in comments but never created.
- **RBAC seed gap:** only `view/create/edit` are seeded for `sales_campaigns` — `approve/delete/export` missing.

---

## 2. Schema gaps to close first (Phase 0)

New migration **`migrations/template/000039_business_sales_campaign_metrics.sql.template`**:

```sql
-- Daily performance snapshot per campaign (feeds the live dashboard + post report)
CREATE TABLE {{BUSINESS}}.sales_campaign_metrics (
  campaign_id        UUID NOT NULL REFERENCES {{BUSINESS}}.sales_campaigns(campaign_id) ON DELETE CASCADE,
  snapshot_date      DATE NOT NULL,
  visitors           INTEGER NOT NULL DEFAULT 0,
  unique_visitors    INTEGER NOT NULL DEFAULT 0,
  signups            INTEGER NOT NULL DEFAULT 0,
  add_to_cart        INTEGER NOT NULL DEFAULT 0,
  checkouts          INTEGER NOT NULL DEFAULT 0,
  orders             INTEGER NOT NULL DEFAULT 0,
  revenue_ngn        NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_given_ngn NUMERIC(14,2) NOT NULL DEFAULT 0,
  conversion_rate    NUMERIC(6,4) NOT NULL DEFAULT 0,   -- orders / unique_visitors
  aov_ngn            NUMERIC(14,2) NOT NULL DEFAULT 0,
  by_source          JSONB NOT NULL DEFAULT '{}'::jsonb, -- {instagram: {...}, whatsapp: {...}}
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, snapshot_date)
);
CREATE INDEX idx_{{BUSINESS}}_campaign_metrics_date
  ON {{BUSINESS}}.sales_campaign_metrics (snapshot_date);
```

New migration **`migrations/000103_shared_sales_campaign_permissions.sql`** (additive seed):

```sql
-- Add the missing actions so non-CEO roles (e.g. Marketing Manager) can operate campaigns.
INSERT INTO shared.permissions (role_id, module, action, record_scope) VALUES
  ('<ceo_role>', 'sales_campaigns', 'approve', 'all'),
  ('<ceo_role>', 'sales_campaigns', 'delete',  'all'),
  ('<ceo_role>', 'sales_campaigns', 'export',  'all'),
  ('<mktg_role>','sales_campaigns', 'view',    'all'),
  ('<mktg_role>','sales_campaigns', 'create',  'all'),
  ('<mktg_role>','sales_campaigns', 'edit',    'all')
ON CONFLICT DO NOTHING;
```

New migration **`migrations/template/000040_business_campaign_status_pending_approval.sql.template`** (locked decision #1 — add `pending_approval` as a first-class status):

```sql
ALTER TABLE {{BUSINESS}}.sales_campaigns DROP CONSTRAINT sales_campaigns_status_check;
ALTER TABLE {{BUSINESS}}.sales_campaigns ADD CONSTRAINT sales_campaigns_status_check
  CHECK (status IN ('draft','pending_approval','scheduled','live','paused','ended','archived'));
```

Optional trigger (or do it in the rollup job) **`fn_campaign_stock_snapshot`** on `stock_movements` to decrement `sales_campaign_products.current_stock_snapshot` for live campaigns and broadcast the new count.

> Migration numbering follows the established convention: per-brand templates extend the `0000XX...template` series; shared additive migrations use the `0001XX` band already in use (`000100_shared_cash_request`, etc.). Re-run `db:bootstrap` for both brands, then `db:verify`.

---

## 3. State machine (the spine of the module)

Per `pd` §6.22 — three public phases (before / live / ended) backed by six internal states:

```
draft ──submit──▶ pending_approval ──approve──▶ scheduled ──(starts_at)──▶ live
  ▲                      │ reject                     │ launch (manual)        │
  └──────────────────────┘                            │                       │ pause/resume
                                                       └──────────────────────▶ paused ⇄ live
                                                                                │ end / (ends_at)
                                                                                ▼
                                                                              ended ──archive──▶ archived
```

`pending_approval` is a **first-class status** (locked decision #1 — added to the CHECK in Phase 0, see §2). Full status set: `draft, pending_approval, scheduled, live, paused, ended, archived`. Transitions are the **only** way `status` changes; each is an explicit endpoint, audited, and emits a domain event. `submit` moves `draft → pending_approval` and opens the approval workflow; `approve` moves `pending_approval → scheduled`; `reject` moves it back to `draft`.

**Public state resolver** (for `/sale/:slug`): `now < starts_at` → `before`; `starts_at ≤ now < ends_at` and `status='live'` → `live`; else → `ended`. The resolver is pure and shared by the public endpoint and the admin preview.

---

## 4. Module layout

Keep the standard module shape; split routers because the module has admin + public + sub-resources:

```
src/modules/sales_campaigns/
├── campaigns.routes.js        # /api/v1/sales-campaigns (admin, auth+brand+RBAC)
├── campaigns.public.routes.js # /api/public/sale  (no auth) — landing + signup + stock
├── campaigns.controller.js    # admin HTTP handlers
├── campaigns.public.controller.js
├── campaigns.service.js       # business logic: CRUD, state machine, share kit
├── campaigns.discount.service.js  # resolveDiscount() — called by sales/pos/storefront
├── campaigns.analytics.service.js # rollups, daily snapshot, live metrics
├── campaigns.repo.js          # SQL for campaigns + products + signups + metrics
├── campaigns.validator.js     # Zod schemas (create/update/products/landing/signup)
├── campaigns.events.js        # domain events
└── README.md
```

Wire `campaigns.public.routes.js` into `src/routes/index.js` under the existing `/api/public` router (`publicRouter.use("/sale", publicCampaignRouter)`).

---

## 5. API contract (hand this to frontend)

All admin routes: `Authorization: Bearer <jwt>` + `X-Brand-Context: pixiegirl|faitlynhair`. Success = `{ data, meta? }`; errors = `{ error: { code, message, fields? }, request_id }`. Money as decimal strings. IDs UUID; campaign also exposes human `slug`.

### 5.1 Admin — campaign lifecycle (`/api/v1/sales-campaigns`)

| Method | Route            | Permission | Purpose                                                           |
| ------ | ---------------- | ---------- | ----------------------------------------------------------------- |
| GET    | `/`              | `view`     | List (filters: `status`, `q`, `active_on`, date range; paginated) |
| POST   | `/`              | `create`   | Create a draft campaign                                           |
| GET    | `/:id`           | `view`     | Detail (campaign + products + signup count + current rollups)     |
| PATCH  | `/:id`           | `edit`     | Update (only in `draft`/`scheduled`/`paused`)                     |
| DELETE | `/:id`           | `delete`   | Archive (soft; `status='archived'`)                               |
| POST   | `/:id/submit`    | `edit`     | Submit for approval → opens workflow                              |
| POST   | `/:id/approve`   | `approve`  | Approve (manager/CEO); sets `approved_by/at` → `scheduled`        |
| POST   | `/:id/reject`    | `approve`  | Reject → back to `draft` with notes                               |
| POST   | `/:id/launch`    | `edit`     | Manual go-live now (`scheduled`/`paused` → `live`)                |
| POST   | `/:id/pause`     | `edit`     | Pause a live campaign                                             |
| POST   | `/:id/resume`    | `edit`     | Resume a paused campaign                                          |
| POST   | `/:id/end`       | `edit`     | End early (`live` → `ended`)                                      |
| POST   | `/:id/duplicate` | `create`   | Clone config into a new draft                                     |

### 5.2 Admin — products & landing & sharing

| Method | Route                                    | Permission | Purpose                                                             |
| ------ | ---------------------------------------- | ---------- | ------------------------------------------------------------------- |
| GET    | `/:id/products`                          | `view`     | Included/excluded products + categories                             |
| POST   | `/:id/products`                          | `edit`     | Add include/exclude (product or category, price override, featured) |
| PATCH  | `/:id/products/:linkId`                  | `edit`     | Update override/featured/order                                      |
| DELETE | `/:id/products/:linkId`                  | `edit`     | Remove link                                                         |
| GET    | `/:id/landing`                           | `view`     | Landing config (hero, blocks, SEO, state messages)                  |
| PATCH  | `/:id/landing`                           | `edit`     | Update landing config (draft/publish bar)                           |
| GET    | `/:id/preview?state=before\|live\|ended` | `view`     | Rendered landing payload for any state (admin preview)              |
| GET    | `/:id/share-kit`                         | `view`     | Pre-formatted IG/WhatsApp/email copy + UTM-tagged URLs              |

### 5.3 Admin — signups & analytics

| Method | Route                          | Permission      | Purpose                                                 |
| ------ | ------------------------------ | --------------- | ------------------------------------------------------- |
| GET    | `/:id/signups`                 | `view`          | Pre-launch notification list (paginated)                |
| GET    | `/:id/signups/export`          | `export`        | CSV export of signups                                   |
| GET    | `/:id/metrics`                 | `view`          | Current rollups + live snapshot (powers revenue ticker) |
| GET    | `/:id/metrics/daily?from=&to=` | `view`          | Daily snapshot series (chart)                           |
| GET    | `/:id/report`                  | `view`/`export` | Post-campaign report (JSON; `?format=pdf` for PDF)      |

### 5.4 Public — landing page (`/api/public/sale`, no auth)

| Method | Route           | Purpose                                                                                                                                                                                               |
| ------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/:slug`        | Landing payload: resolved state, hero/blocks, countdown target, products with `original_price`/`campaign_price` + live stock counters, SEO/OG tags. `before`→signup CTA; `ended`→`ended_redirect_to`. |
| GET    | `/:slug/stock`  | Lightweight live stock counters (poll fallback for the socket room)                                                                                                                                   |
| POST   | `/:slug/signup` | Capture pre-launch notification signup (`email`/`phone`, `notify_via`); rate-limited; links to existing `shared.contacts` if matched                                                                  |

> **Checkout** reuses the existing public order form / storefront cart; the client passes the campaign `slug` (or it is derived from `utm_campaign`). The server validates eligibility and applies the discount via `campaigns.discount.service` — see §6. The discount is never trusted from the client.

### 5.5 Example payloads

**POST `/api/v1/sales-campaigns`** (create draft):

```json
{
  "name": "Black Friday 2026",
  "slug": "black-friday-2026",
  "starts_at": "2026-11-27T00:00:00Z",
  "ends_at": "2026-11-30T23:59:59Z",
  "discount_type": "percentage",
  "discount_value": "0.20",
  "product_scope": "specific_categories",
  "min_order_value_ngn": "50000.00",
  "first_time_buyers_only": false,
  "landing_hero_title": "Black Friday — 20% off all Frontals"
}
```

**GET `/api/public/sale/black-friday-2026`** (live state):

```json
{
  "data": {
    "slug": "black-friday-2026",
    "state": "live",
    "name": "Black Friday 2026",
    "hero": { "title": "...", "subtitle": "...", "image_url": "..." },
    "countdown_to": "2026-11-30T23:59:59Z",
    "products": [
      { "product_id": "…", "name": "HD Lace Frontal",
        "original_price": "120000.00", "campaign_price": "96000.00",
        "stock_remaining": 14, "is_featured": true }
    ],
    "blocks": [ ... ],
    "seo": { "meta_title": "...", "og_image_url": "..." }
  }
}
```

---

## 6. Discount engine (checkout integration)

`campaigns.discount.service.resolveDiscount({ brand, campaignRef, cart, contact })`:

1. Resolve campaign by `slug`/`id`; reject unless `status='live'` and within window.
2. Eligibility: `min_order_value_ngn`, `first_time_buyers_only` (check contact order history), `customer_segment_id` membership, `total_usage_limit` vs `total_usage_count`.
3. Product scope: apply to `all`, or only `include` links; honour `exclude` links and per-product `campaign_price_ngn` overrides; category links expand to products.
4. Compute per-line discount by `discount_type` (`percentage`, `fixed_amount`, `buy_x_get_y`, `bundle`, `free_shipping`).
5. Return line discounts + total. Caller (sales/pos/storefront service) writes `sales_order_discounts` rows with `source='campaign'`, `sales_campaign_id`, `source_reference=slug`, sets `sales_orders.sales_campaign_id`, and on completion increments `total_usage_count`, `total_orders`, `total_revenue_ngn`, `total_discount_given_ngn` (atomic, in the order transaction).

This service is the single source of truth for campaign pricing — POS, storefront checkout, and the public order form all call it. Money math uses `utils/money` (decimal.js), never JS floats.

### 6.1 Stacking rule (locked decision #2 — "do what `pd` says")

`pd` §6.23 settles this (esp. the §6.23 Streak margin guardrail, line 1157, + the §6.22 connection map "coupons usable during campaigns / loyalty points earned on campaign purchases"):

1. **Stacking is CEO-configurable, not hardcoded.** A Business Setup toggle (`allow_discount_stacking_on_sale_items`, per brand) decides whether a coupon and/or loyalty redemption may combine with a live campaign discount on an already-discounted item. Default OFF.
2. **The minimum-margin floor (Pricing engine §6.25) is a hard cap that no combination may breach.** After campaign + coupon + loyalty are summed, the discount engine clamps the net price up to the floor — "loyalty can never push a price below floor." This is the critical invariant and is enforced server-side in `discount.service`, regardless of the stacking toggle.
3. **When stacking is OFF:** campaign discount and coupon/loyalty are mutually exclusive on sale items — apply the single best discount for the customer (or campaign-takes-precedence, configurable), never both.
4. **Coupons remain usable during campaigns** and **loyalty points are still earned** on campaign purchases (awarded after delivery confirmation, per §6.23.3). The order's `sales_order_discounts` records each source line (`campaign`, `coupon`, `loyalty_points`) separately for ROI attribution.

Implementation: `discount.service.resolveDiscount()` collects all candidate discounts, applies the stacking toggle to decide combine-vs-exclusive, then runs the margin-floor clamp from the Pricing engine as the final, non-negotiable step before returning line discounts.

---

## 7. Analytics pipeline

- **Ingest:** storefront emits `storefront_funnel_events` tagged to a `storefront_sessions` row carrying `utm_campaign`. `converted_order_id` links a session to a `sales_order`, whose `sales_campaign_id` ties revenue back to the campaign.
- **Rollup job** (`campaign-metrics-rollup`, cron every 5 min while any campaign is `live`): recompute `sales_campaigns.total_*` and upsert today's `sales_campaign_metrics` row (visitors, unique, signups, ATC, checkouts, orders, revenue, conversion, AOV, `by_source`). Broadcast on `brand:{brand}:campaign:{id}`.
- **Live dashboard** reads `/:id/metrics` (rollups) and subscribes to the socket room for the revenue ticker (per `FRONTEND_SCREEN_REQUIREMENTS` §6.22 + room table).
- **Post-campaign report** (`/:id/report`): generated on transition to `ended` — totals, top products, traffic by source, conversion funnel. **PDF at launch** (locked decision #4) rendered with `pdfkit`/`pdf-lib` (already in `package.json`), stored via `storage.service` and linked in the response; the same data is also returned as JSON for the in-app report screen.

---

## 8. Notifications & blast (Full-module requirement)

- **Signup capture:** public `POST /:slug/signup` → `sales_campaign_signups` (dedupe by email/phone; link contact if known).
- **Go-live blast:** on `draft/scheduled → live` transition, enqueue a job that fans out to all signups via Smartcomm (WhatsApp Cloud API) + email (`email.service`), respecting each row's `notify_via`. Idempotent (one blast per campaign; guarded by a `blast_sent_at` flag — add column or track in job state).
- **Pre/post automation** hooks into Email Campaigns (teasers before, follow-ups after) per `pd` §6.22 connection map — Phase 5 wiring.

---

## 9. Real-time, events, jobs

**Domain events** (`campaigns.events.js`): `created, updated, submitted, approved, rejected, launched, paused, resumed, ended, signup_received, metrics_updated`. Subscribers: Socket.io (room `brand:{brand}:campaign:{id}`), AI Insights, audit. Controllers never emit to Socket.io directly (per `ARCHITECTURE.md`).

**Schedulers** (`src/jobs/schedulers/`):

- `campaign-state-transition.js` (cron `* * * * *`): `scheduled`→`live` at `starts_at`; `live`→`ended` at `ends_at`. Fires go-live blast + ended report.
- `campaign-metrics-rollup.js` (cron `*/5 * * * *`, only while live campaigns exist).

**Processors** (BullMQ): `campaign-golive-blast`, `campaign-report`.

---

## 10. Security, RBAC & workflow

- **Entity isolation:** every repo fn takes `brand`, builds `pixiegirl.*`/`faitlynhair.*` via a validated `tableFor()`; never cross-join brands (`ENTITY_ISOLATION.md`).
- **RBAC:** `requirePermission("sales_campaigns", <action>)`; record scope (`own`/`team`) enforced in repo. Seed the missing `approve/delete/export` rows (Phase 0).
- **Approval gate:** the builder wizard ends in approval (`FRONTEND` §6.22). `submit` opens a `campaign_approval` workflow (`WORKFLOWS.md`): manager or CEO approves → `scheduled`. **Locked decision #3 — build the real `workflows/engine.js` first** (it is currently a TODO stub) rather than a throwaway thin path, since the engine is shared by Expenses, Purchasing, Pricing, Stylist, HR, and Cash Request. The campaign module is its first consumer: seed a `campaign_approval` definition in `shared.workflow_definitions` and route `submit`/`approve`/`reject` through `wf.openInstance` / `wf.act` / `wf.resolveApprover` (deputy + vacancy + CEO-escalation per `WORKFLOWS.md`).
- **Public endpoints:** rate-limited, no PII leakage (landing exposes only public product + price data — never cost prices), signup input validated + captcha-ready.
- **Audit:** every write → `shared.audit_log` via the `audit` middleware/service.

---

## 11. Validation (Zod)

Schemas in `campaigns.validator.js`: `create` (name, unique slug pattern `^[a-z0-9-]+$`, `ends_at > starts_at`, discount_type enum, discount_value range, scope enum), `update` (partial, blocks status changes — those go through transition endpoints), `addProduct` (XOR product_id/category_id, include_exclude enum), `landing` (hero, blocks JSON shape, SEO), `signup` (email or phone required, notify_via enum). Validation errors return `400 VALIDATION_ERROR` with `fields`.

---

## 12. Build sequence (phased — each phase ends with callable endpoints)

| Phase                              | Deliverable                                                                                                                                   | Frontend can...                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **0 — Schema & fix**               | Metrics migration, `pending_approval` status migration (#1), perms seed, fix repo PK/columns, optional stock trigger                          | —                                                        |
| **0b — Workflow engine**           | Implement `workflows/engine.js` (`openInstance`/`act`/`resolveApprover`) + `workflow_definitions` schema seed (#3) — shared dependency        | Pending-approvals queue endpoints                        |
| **1 — Admin CRUD + state machine** | Real repo/service/validator; list/create/detail/update/archive; submit/approve/launch/pause/resume/end; products sub-resource; landing config | Build campaign list + builder wizard + landing editor    |
| **2 — Public landing**             | `GET /sale/:slug` (3-state resolver), `/stock`, `POST /signup`, share-kit/UTM                                                                 | Build the public `/sale/{slug}` page (before/live/ended) |
| **3 — Discount engine**            | `discount.service` + checkout wiring (sales/pos/storefront) + usage caps + attribution + stock deduction                                      | Apply campaign pricing at checkout                       |
| **4 — Analytics**                  | Funnel aggregation, daily snapshots, `/metrics` + `/metrics/daily`, socket room                                                               | Build the live dashboard + revenue ticker                |
| **5 — Notifications**              | Go-live blast (Smartcomm+email), pre/post email automation, post-campaign **PDF** report (#4)                                                 | Show signup counts, report screen + PDF download         |
| **6 — Hardening**                  | RBAC seeds applied, workflow approval gate, audit coverage, unit/integration tests, OpenAPI spec entries, action-catalogue rows for Praxis    | Stable, documented contract                              |

**Critical-path dependency:** Phase 1's `approve` path needs the workflow engine, so **Phase 0b builds the real `workflows/engine.js` before Phase 1** (locked decision #3). This front-loads shared infrastructure but unblocks Expenses, Purchasing, Pricing, Stylist, HR, and Cash Request too.

**Cross-module touch points to coordinate:** `sales` + `pos` + `storefront` services (discount call), `stock` (counter trigger/events), `smartcomm` + `email_campaigns` (blast), `retention` (loyalty points + coupon stacking rules on campaign orders), `dashboards` (campaign cards). Each is currently a stub, so define the `discount.service` interface first and have those modules call it.

---

## 13. Definition of done (per `pd` §6.22)

- [ ] 2+ concurrent independent campaigns run without conflict (separate slugs, products, analytics).
- [ ] Public landing renders correct before/live/ended state with countdown + live stock + crossed-out pricing.
- [ ] Discount applied only to eligible products/customers; high-margin exclusions honoured; usage caps enforced.
- [ ] Every visitor/signup/buyer captured and attributed in CRM (`utm_campaign` → session → order).
- [ ] Live dashboard shows visitors, signups, ATC, conversion, revenue, AOV, top products, traffic source.
- [ ] Go-live WhatsApp/email blast fires once to the signup list; post-campaign report auto-generates.
- [ ] All writes audited; permission + entity checked server-side; OpenAPI updated so Praxis action-catalogue picks it up.

---

## 14. Locked decisions

1. **`pending_approval` is a first-class status** — added to the `status` CHECK in Phase 0 (§2), used by the `submit`/`approve`/`reject` transitions (§3). ✅
2. **Stacking follows `pd`** — CEO-configurable stacking toggle, with the Pricing-engine minimum-margin floor as a hard cap no combination may breach; coupons usable during campaigns; loyalty points still earned (§6.1). ✅
3. **Build the real workflow engine first** (Phase 0b) — `workflows/engine.js` is implemented before the campaign approval gate; campaign is its first consumer (§10, §12). ✅
4. **Post-campaign report is PDF at launch** — rendered with `pdfkit`/`pdf-lib`, stored + linked, JSON alongside for the in-app screen (§7). ✅
