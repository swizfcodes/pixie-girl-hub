# FRONTEND — INSTRUCTION (MUST READ BEFORE BUILDING)

**Status:** Build-ready contract · **Read this first, every time** — whether you are a human engineer or an AI coding agent.
**This file is the short, enforceable rulebook.** The deep spec is `Frontend_Engineering_Guide_v2.2.md` (1,233 lines) and `FRONTEND_SCREEN_REQUIREMENTS.md`. This file tells you the rules you may **never** break and the bar you must always hit. If you only read one document, read this — then open the relevant module section in the guide.

---

## 0. The one-paragraph brief

We are building **two surfaces** on one shared design system: the **Hub** (the ERP / back-office — a React PWA) and the **Storefront** (the public site — Next.js SSR). The Hub must feel **as easy as WhatsApp or Instagram** — never as dense or intimidating as Zoho / Odoo / SAP / Sage — while being **extremely beautiful, creative, and production-grade**. **Mobile-first**, with flawless desktop responsiveness up to large screens. Everything is **driven from the database and from theme tokens**: we hard-code as little as humanly possible, because this product is a **white-label model** — we clone it for a new client and re-skin it with config, not code.

---

## 1. Source-of-truth hierarchy (resolve every conflict in this order)

1. **Migration SQL** (`migrations/**`) — table / column / constraint truth.
2. **OpenAPI spec** (`docs/openapi.yaml`) — endpoint / request / response truth.
3. **`Frontend_Engineering_Guide_v2.2.md`** — UI / UX / behaviour truth.
4. **Product Description v2.2** — intent / scope truth.
5. **`ADMIN_UI_REQUIREMENTS.md`** — *advisory only* (it predates the 425-table schema and has known errors; see guide §0.4). Never wire to it blindly.

When you build a module with an AI agent, attach: **this file + the guide's module section + the module's migration file(s) (guide Appendix A) + the module's OpenAPI paths.**

---

## 2. The 10 non-negotiable rules (a violation is a bug, not a style choice)

1. **Entity scope on every call.** A single `activeEntity` (`PXG` | `FLH` | `ALL`) lives in the global store and is attached to **every** API request and **every** query key. `ALL` is **CEO-only**, read-only aggregation; any write forces a single entity. Staff never see another entity's data.
2. **The API is the only security boundary.** There is **no DB row-level security** — entity + field isolation are enforced server-side. Hiding a field in the UI is courtesy, not security. **Never request a hidden field** (`cost_price_ngn`, salary, factory cost, location data) for a role that can't see it, and never assume hiding it client-side protects it.
3. **Permission-aware rendering, always.** Read the user's `permissions` matrix (module × action × scope) on mount. No `view` → route guard blocks. No `edit` → render read-only. No `delete`/`approve` → hide the control. The absence of a button is **never** the enforcement; the API re-checks.
4. **Render config from the DB — never hard-code business values.** Tier thresholds, KPI weights, tax/VAT/WHT rates, document prefixes, pipeline stages, service types, loyalty multipliers, currencies, **brand colours, logos, fonts** — all come from their config tables/tokens. Hard-coding any of these is a bug.
5. **Workflow-gated writes go to `workflow_instances`, not the target table.** If an action is gated by a `workflow_definition` (e.g. expense above a manager's threshold, price change above a floor), submit an approval request — do not mutate the target record directly. Show the approval chain **before** submit and the progress strip after.
6. **Money is NGN-based with a display currency.** Every monetary record stores `*_ngn` (the truth) + `display_currency` + `fx_rate_used` (a snapshot). Render via `<MoneyText>`; show NGN on financial screens. **Never** recompute a historical figure with today's live rate.
7. **Append-only / posted records are read-only.** Ledgers, `*_state_history`, `stock_movements`, `*_payments`, `audit_log`, posted journals — **reverse or adjust, never edit**. State-machine screens offer only valid transitions.
8. **Audit every write.** Every create/edit/delete writes a `shared.audit_log` row (server-side). Surface "last edited by / at" wherever the table carries `updated_by` / `updated_at`.
9. **Every screen ships four states.** Loading (skeleton matching the final layout — never a bare spinner), Empty (contextual message + create CTA *if permitted*), Error (human message + retry, logged — never a raw stack trace), Permission-denied (a clear panel, not a crash). No exceptions.
10. **Two-layer theming (see §4).** Never inline a hex value or a font name. Everything reads a CSS variable so the product is white-label and per-brand themeable.

---

## 3. The experience bar (this is what "good" means here)

- **WhatsApp / Instagram ease, not enterprise dread.** A new staffer should be productive in minutes with no training. Primary action obvious; secondary actions tucked away; never more than a couple of decisions per screen. If a screen feels like Odoo, it's wrong.
- **Mobile-first.** Design the phone layout first, then enhance for desktop. POS, clock-in, stylist tasks, expense capture, service-job updates, Praxis voice, and all customer-facing pages are **mobile-first and touch-optimised** (≥44×44px targets). Manager dashboards / pricing engine / org canvas may be desktop-first but must still degrade gracefully.
- **Extremely beautiful & creative, but never at the cost of clarity or performance.** Tasteful motion (respect `prefers-reduced-motion`), smooth micro-interactions, generous whitespace, real empty-state illustrations. Beauty serves comprehension — decoration that slows the page or hides the action is a regression.
- **Fast on Nigerian networks.** Budget Core Web Vitals (LCP / CLS / INP). Skeletons over spinners. WebP, responsive images, lazy-load. Code-split per route; lazy-load heavy bespoke builds (Org canvas, Pricing engine, Storefront Studio) and charts.
- **Coherence.** One DataTable, one Drawer, one Form system, one set of pills/badges/tiles everywhere. A screen the user has never seen should still feel familiar.

---

## 4. Theming — the two-layer model (CRITICAL, and the white-label spine)

There are **two independent appearance layers**. Keep their tokens in separate namespaces and never collapse them.

### Layer A — App Appearance (`--app-*`) — the PLATFORM identity
This is the ERP application's own skin: **what makes "Pixie Girl Hub" become "ClientX ERP" for a new client with zero code change.** It themes the shell chrome (sidebar, top bar, default surfaces, buttons), the login/splash screen, the favicon, and the product name/logo.

| Token | Purpose |
|---|---|
| `--app-name`, `--app-logo`, `--app-favicon` | product identity shown in shell + login |
| `--app-accent`, `--app-accent-contrast` | primary action colour for the ERP chrome |
| `--app-bg`, `--app-surface`, `--app-surface-2`, `--app-border`, `--app-text`, `--app-text-muted` | neutral surface system |
| `--app-font-sans`, `--app-font-display` | UI + heading fonts |
| `--app-radius`, `--app-density` | corner roundness + row density |
| semantic: `--success`, `--warning`, `--danger`, `--info` | shared, theme-agnostic |

**Source of truth:** a platform-level **App Appearance config** (one row per deployment), editable from **Settings → Appearance** (CEO/owner). ⚠️ **Backend dependency (flag, then proceed):** the schema today has **per-brand** branding (`business_config.accent_colour/logo_path/brand_fonts`) and **per-brand** `storefront_themes`, but **no app-level appearance table**. Add `shared.app_appearance` (or `shared.app_config` with an `appearance` JSONB) — singleton per deployment — holding the `--app-*` values above. Until it exists, read `--app-*` from a typed config constant seeded from env, and mark the Settings → Appearance screen **BLOCKED ON BACKEND** for persistence. **Build the UI now; it is the demo's centrepiece.**

### Layer B — Brand Appearance (`--brand-*`) — each BUSINESS identity
Each business inside the platform (PXG, FLH, and any future brand) has its own colour/logo/fonts from `business_config` + `shared.storefront_themes`.

- In the **Hub**, the app chrome stays on **App Appearance** (consistent, so the CEO toggling brands isn't visually jarring). The **brand indicator** near the entity switcher is the **one** element that tints to `--brand-accent` of the active entity. (Guide §1.5; Screen-Reqs "Design Tokens & Theming".)
- In the **Storefront**, the **whole site** themes to the brand (`storefront_themes.tokens`), edited in Storefront Studio (draft → preview → publish, brand-lock on by default).

### Rules
- **Never** write a literal hex, font-family, or radius in a component. Read the variable.
- App layer and brand layer are set by **different config**, edited on **different screens**, and changed by **different people** (platform owner vs brand manager). Don't let one leak into the other.
- A new client = clone the repo, deploy, set **one** App Appearance row + their brand rows. No component edits.

---

## 5. Architecture & stack (fixed decisions)

- **Hub:** React PWA. **Storefront:** Next.js SSR. **Stylist portal:** lightweight React (scoped to `hub_stylist`).
- **Client state:** Zustand (auth, `activeEntity`, UI prefs, theme). **Server state:** TanStack Query (all API data; mutations invalidate keys; optimistic updates for kanban/drag).
- **Styling:** design tokens (CSS variables, §4) + utilities. **No component-library lock-in** — build the primitives once and reuse.
- **Real-time:** Socket.io (stock, notifications, messages, dashboard tiles, Praxis run-steps, campaign metrics, POS sessions). Reconcile socket events into the query cache — don't double-fetch.
- **Forms:** one schema-driven form system mirroring each endpoint's `payload_schema`; map server validation errors back onto fields.
- **Charts:** one `<Chart>` wrapper. **Maps:** one `<MapView>` wrapper (geofences, clock-in pins, courier tracking).
- **Tokens:** access token in memory, refresh token in httpOnly cookie. **Never** localStorage. Silent refresh on 401.
- **Offline:** POS is the one fully-offline screen — queue transactions with a client-generated idempotency key, show "offline — N unsynced", replay on reconnect.

---

## 6. Build the foundation FIRST (≈70% of all screens fall out of this)

Do not start module screens until these exist and are hardened:

1. **Tokens** (both layers, §4) + theme provider + Settings → Appearance editor.
2. **`AppShell`** — top bar (entity switcher, global Cmd-K search, notification bell, AI usage meter, Praxis launcher, profile) + collapsible grouped sidebar + content area. Responsive: sidebar → icons → drawer on mobile.
3. **`DataTable`** — server-driven (pagination, sort, multi-filter, search), per-column renderers, row selection + bulk actions, row→Drawer, the four states, density toggle, column show/hide, responsive→cards. *Most list screens are configuration of this, not new code.*
4. **`Drawer`** (the dominant detail/edit pattern) + **`Modal`** + **`Popover`** + **`Tooltip`**.
5. **Form system** — `FormSection`, `FieldRow`, sticky dirty-aware `SaveBar`; custom-field rendering from `custom_field_defs`; permission-aware fields.
6. **`MoneyText`**, **`StatusPill`**/`Badge`, **`KpiTile`**, **`Timeline`**, **`EmptyState`**, **`Skeleton`**, **`MaskedField`** (keys/PINs/account numbers).
7. **Auth + entity context + permission-aware rendering** — the spine everything hangs on.

Then build in this order: CRM · Sales · POS · Stock · Invoicing · Logistics → Accounting · Expenses · Purchasing · Inter-Company → Production · Pricing · HR/Payroll → the 3 bespoke builds (Pricing interactions, Org/Workflow canvas, Storefront Studio) → Marketing/Email/Social/Campaigns/Retention → Stylist + Retail Partners → AI layer (Praxis, Insights, Control) → Storefront (parallel track) + Stylist portal → Settings/Business Setup → polish + a11y pass.

---

## 7. Shared component library (build once, use everywhere)

`AppShell` · `PageHeader` · `Card`/`Section`/`Tabs`/`SplitPane` · `DataTable` · `Drawer`/`Modal`/`Popover`/`Tooltip` · `StatusPill`/`Badge`/`Avatar` · `EmptyState`/`Skeleton` · `Chart`/`KpiTile`/`Timeline`/`MapView` · `MoneyText`/`MaskedField` · all inputs (text/number/currency/select/multiselect/combobox/date/date-range/toggle/checkbox/radio/file/rich-text/tag/colour/slider) · `FormSection`/`FieldRow`/`SaveBar` · `RequirePermission` · `BrandIndicator` · `WorkflowChain` · `StateMachineStepper` · `DraftPublishBar` · `AuditTrail` · `FilterBar` · `BulkActionBar` · `CountdownTimer` · `PraxisPanel`.

---

## 8. Per-screen "Definition of Done" checklist

Copy this into every screen's PR description:

- [ ] **Four states**: loading skeleton (matches layout) · empty (create CTA if permitted) · error (retry, logged) · permission-denied (clear panel).
- [ ] **Permission-aware** controls (view/create/edit/delete/approve) gated against `permissions`; read-only fallback when no edit.
- [ ] **Entity scope** sent on every call; no cross-entity reads; `ALL` only for CEO read views.
- [ ] **Money** via `<MoneyText>` (NGN truth + display currency from the stored rate); hidden cost/salary fields never requested for unauthorised roles.
- [ ] **Workflow-gated** writes submit to `workflow_instances`, not the target table; chain shown before submit.
- [ ] **Config rendered from DB**, nothing business-value hard-coded; **no literal colours/fonts** — tokens only.
- [ ] **Custom fields** (`custom_field_defs`) rendered for the entity type.
- [ ] **State machines** offer only valid transitions; append-only/posted records read-only (void/reverse/adjust).
- [ ] **Real-time** subscriptions reconciled with the query cache; degrades gracefully if sockets/AI unavailable.
- [ ] **a11y**: 44px targets, full keyboard, visible focus, ARIA on DataTable/Drawer/Modal/Tabs, contrast holds under both themes, `prefers-reduced-motion` honoured, state never communicated by colour alone (pills carry text/icons).
- [ ] **Audit-write** fired on every mutation; "updated by/at" shown where present.
- [ ] **Mobile**: verified on a phone viewport first, then desktop up to large screens.

---

## 9. Canonical decisions to resolve with the owner BEFORE the affected screen (guide §0.5)

Render from the DB regardless, but these underlying values must be made canonical or the UI will faithfully show contradictory numbers:
- **D-1** Loyalty tier thresholds (seed `0/5k/25k/100k` vs spec `0/500/2k/5k`) — owner picks one.
- **D-2** Stylist tier labels (Certified/Pro/Elite) — render from config.
- **D-3** KPI weights **must sum to 100** — the **UI is the only guard**; block save otherwise, live running total. Non-negotiable.
- **D-7** Payment-fee pass-through — fees absorbed into published price; checkout shows **one clean total**, never a "+₦X fee" line.
- **D-8** Manual-payment button — **hidden** unless `business_config.allow_staff_manual_payments` is true (separation of duties).
- **Backend-blocked (build UI behind a flag, don't ship writing-to-nowhere):** e-signature (D-4), Hair Quiz (D-5), extended Streak-Stars earn-actions (D-6), wishlist, POS offline idempotency key, and the **App Appearance table** (§4). See guide Appendix C.

---

## 10. White-label discipline (why this all matters)

This product is cloned per client. Therefore:
- **"Clone" means one shared codebase deployed N times, configured per client — never a fork you edit per client.** The day a component contains a client-specific value, the model is broken.
- **Everything brandable is data:** App Appearance (§4 Layer A), brand appearance (Layer B), copy, currencies, tax, roles, categories, pricing rules, feature flags.
- **Logic stays in code** (parameterised), never in DB rows. Don't build a configuration system so flexible it becomes an untestable second programming language.
- A new client should go live by setting **one App Appearance row + their brand rows + their config** — and nothing else.

---

*Read the matching module section in `Frontend_Engineering_Guide_v2.2.md` before building any screen. This file governs the rules; the guide governs the detail; the migration + OpenAPI govern the fields and endpoints. See `docs/frontend-demo/index.html` for a working reference of the shell, the core components, and the two-layer theming in action.*
