# Schema Changelog — Pixie Girl Hub Shared Migrations

Tracks edits made to the shared migrations after the initial draft. Each
entry names the SOURCE (which V-of-spec drove the change), the FILES
edited, and a precise WHAT/WHY.

The intent of editing in place (rather than appending patch migrations)
is so that a clean checkout of `migrations/` is the complete, current
truth for the database. A first-time deployment never has to apply
patches; only the in-order `.sql` files.

---

## 2026-05-26 — V2.2 alignment

**Source:** `PixieGirl_Hub_Product_Description_V2__2_.html`
(V2.2 of the Product Description, received 2026-05-26)

### Summary of the spec delta

V2.2 added five concrete refinements over V2.1:

1. **Module 6.11 (HR & Payroll)** — Faitlyn employment-handbook detail:
   probation tracking, leave balances (annual / public holidays /
   "Special Event Days" day-off-in-lieu), non-solicitation window,
   summary-dismissal trigger log, sale-channel on commissions,
   weighted performance appraisal (Customer Feedback 40% / Sales
   Conversion 25% / Work Quality 20% / Cleanliness 15%).
2. **Module 6.24 (Production)** — the Faitlyn "Service Job Tracker"
   (digitises the Hair Assignment Register), with a 5-item service
   taxonomy (Installation / Revamping / Colour Creation /
   Customization / Packing), each priced and tracked individually
   for itemised intercompany styling invoices.
3. **Module 6.27 (Org & Workflow Builder)** — dotted-line reporting
   (information only, no approval authority), deputy pattern
   (a role inheriting "most of the CEO's operational capacities"),
   amount-thresholded approvals (manager approves up to N, escalates
   above).
4. **Module 6.30 (AI Insights)** — auto-generated weekly reports
   (replacing the manual Saturday 8 PM Zoho/Sheet ritual).
5. **Section 8 (Technology) — NEW deep-dive AI pages (8.1–8.5)**:
   - Thin-server stack: DeepSeek (LLM) + Groq Whisper API
     (transcription) + OpenAI text-embedding-3-small (embeddings) +
     pgvector
   - Three vendors → three encrypted, CEO-controlled API keys
   - **Future-proofing the embeddings**: dedicated table keyed to
     source records, with `embedding_model` + `embedding_version`,
     source text retained alongside the vector
   - Permission-scoped + entity-scoped RAG retrieval **before**
     similarity ranking (data-leak prevention)
   - Action catalogue gains `entity_scope` and explicit `is_write`

### Files edited in place

| File                          | What changed                                                                                                                                                                                                                                                                                                                                            | Why                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `000003_shared_people.sql`    | `staff_profiles`: added probation*\*, annual_leave*_, public*holiday*_, special*event_days*_, non*solicit*_, dismissal_triggers_log                                                                                                                                                                                                                     | Module 6.11 — Faitlyn HR fields                                                                                              |
| `000003_shared_people.sql`    | `staff_profiles`: added 2 partial indexes (probation ending, non-solicit active)                                                                                                                                                                                                                                                                        | Common HR queries from spec                                                                                                  |
| `000003_shared_people.sql`    | `leave_requests`: extended `leave_type` CHECK to include `special_event_in_lieu`, `public_holiday`, `bereavement`                                                                                                                                                                                                                                       | Module 6.11 leave types                                                                                                      |
| `000003_shared_people.sql`    | `org_positions`: added `reports_to_position_id` (solid-line FK), `is_deputy` flag, `deputy_capacities[]`, `approval_threshold_ngn`                                                                                                                                                                                                                      | Module 6.27 — deputy pattern + thresholds                                                                                    |
| `000003_shared_people.sql`    | **NEW table** `org_position_dotted_lines`                                                                                                                                                                                                                                                                                                               | Module 6.27 — dotted-line reporting (info-only, never used for approval routing)                                             |
| `000003_shared_people.sql`    | `workflow_definitions` comment: expanded JSON shape to document amount thresholds, deputy fallback, dotted-line non-routing                                                                                                                                                                                                                             | Module 6.27 — clarification for engineers                                                                                    |
| `000012_shared_ai.sql`        | `ai_action_catalogue`: **removed inline `embedding vector(1536)` column**, added `title`, `entity_scope` (pxg/flh/both/any), `is_write` boolean; dropped `idx_ai_actions_embedding` (moves to new table)                                                                                                                                                | V2.2 §8.1 (embeddings in dedicated table) + §8.3 (entity_scope, is_write)                                                    |
| `000012_shared_ai.sql`        | `ai_knowledge_chunks`: **removed inline `embedding vector(1536) NOT NULL`**; added `required_permissions[]`, `sensitivity`, `contains_field_tags[]`, `content_hash`; widened source_type CHECK to include `action_catalogue` and `action_example`                                                                                                       | V2.2 §8.4 (permission-scoped retrieval BEFORE similarity ranking) + §8.1 (dedicated embeddings table)                        |
| `000012_shared_ai.sql`        | **NEW table** `shared.ai_embeddings` (the dedicated embeddings store) — soft FKs by `(source_table, source_id, source_sub_key)`, columns for `embedding_model`, `embedding_version`, `embedding_dim`, retained `source_text`, denormalised `business` + `required_permissions[]` + `sensitivity` for filter-before-rank, `is_stale` flag for migrations | V2.2 §8.1 ("a future move off vector(1536) becomes a controlled migration, with no data loss and no core-schema disruption") |
| `000012_shared_ai.sql`        | **NEW table** `shared.ai_vendor_credentials` — encrypted multi-vendor API key store; cost tables (per-1k input/output tokens, per-audio-minute); per-vendor monthly caps                                                                                                                                                                                | V2.2 §8.1 ("three vendor keys, stored encrypted, CEO-controlled, AI Control meters per-vendor usage")                        |
| `000012_shared_ai.sql`        | `ai_usage_ledger`: added `audio_seconds` column; clarified `provider` semantics                                                                                                                                                                                                                                                                         | V2.2 §8.1 (Groq Whisper bills per minute, needs separate tracking)                                                           |
| `000012_shared_ai.sql`        | `ai_usage_daily`: added `vendor` to the unique key; added `audio_seconds` aggregate                                                                                                                                                                                                                                                                     | Per-vendor live spend meter on AI Control dashboard                                                                          |
| `000014_shared_triggers.sql`  | `fn_ai_usage_rollup()` updated to include `vendor` and `audio_seconds` in the daily aggregate                                                                                                                                                                                                                                                           | Matches the schema change above                                                                                              |
| `000015_shared_seed_data.sql` | Changed `praxis_voice` default_provider from `self_whisper` to `groq`, default_model unchanged                                                                                                                                                                                                                                                          | V2.2 §8.1 (Groq Whisper API replaces self-hosted)                                                                            |
| `000015_shared_seed_data.sql` | Added 3 new feature flags: `insights_weekly_report`, `insights_service_match`, `embeddings`                                                                                                                                                                                                                                                             | Module 6.30 weekly report auto-gen; service-job anti-pocketing; embeddings as a costed feature                               |
| `000015_shared_seed_data.sql` | Seeded `shared.ai_vendor_credentials` with the 3 launch vendors and current public per-token pricing                                                                                                                                                                                                                                                    | Bootstrap the multi-vendor metering                                                                                          |

### Schema-wide impact summary

- Table count: shared schema went from **101 → 104 tables**
  (added: `org_position_dotted_lines`, `ai_embeddings`, `ai_vendor_credentials`)
- Dropped columns: `ai_action_catalogue.embedding`, `ai_knowledge_chunks.embedding`
- The pgvector ivfflat index moved from being two per-source indexes
  to one unified index on `ai_embeddings.embedding`. The retrieval
  pattern is now: filter by business/permissions/sensitivity in the
  WHERE clause, ORDER BY cosine distance, LIMIT N.

### Still in the per-business templates (next files to be built)

The V2.2 changes that land in the per-business `template/*.sql.template`
files (NOT in shared) are noted here for tracking:

1. **`000018_business_payroll.sql.template`** — `commission_earned`
   table needs a `sale_channel` column (Instagram / Website / WhatsApp
   / Walk-in) per V2.2 §6.11; performance appraisal tables
   (`performance_cycles`, `performance_scores` with weighted KPIs).
2. **`000015_business_production.sql.template`** — the Faitlyn Service
   Job Tracker (`service_jobs`, `service_types` taxonomy with cost +
   turnaround + colour recipe).
3. **`000023_business_dashboards_reports.sql.template`** — saved
   weekly report templates (Sales report, Customer report) backing
   the auto-generation in `insights_weekly_report`.

These are planned for the per-business template build, not patches.

### Validation

All 16 shared migrations apply cleanly with `ON_ERROR_STOP=1` against
PostgreSQL 16 + pgvector 0.6. End-to-end test confirms:

- Embedding model versioning (two versions side-by-side, stale flag)
- Permission-scoped retrieval (array containment filter before
  vector similarity)
- All 12 spot-checks of V2.2 features pass.

---

## 2026-05-25 — Initial shared schema build

**Source:** `PixieGirl_Hub_Product_Description_V2__1_.html` (V2.1).

Initial 15-file migration set built. See the per-file headers for
scope. No prior changelog entries.

---

## 2026-05-27 — Per-business templates complete (16-35)

All 20 per-business template files added. Each is substituted with
`{{BUSINESS}}` → brand-key by `scripts/bootstrapBusiness.js`.

| File   | Tables | Purpose                                                                                                                                                                                                                    |
| ------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 000016 | 10     | Catalogue (products, variants, categories, collections, images, videos, SEO)                                                                                                                                               |
| 000017 | 10     | Stock SSOT (locations, movements, levels, reservations, alerts, adjustments, transfers, inbound shipments)                                                                                                                 |
| 000018 | 11     | CRM (pipelines, stages, deals + history, activities, notes, preferences, measurements, churn, milestones)                                                                                                                  |
| 000019 | 12     | Sales + sales campaigns (quotations, sales orders, payments, cancellations, campaigns + landing pages)                                                                                                                     |
| 000020 | 8      | POS (terminals, sessions, transactions, splits, drops, voids, summaries)                                                                                                                                                   |
| 000021 | 7      | Invoicing (invoices, lines, payments, reminders, credit notes, receipts)                                                                                                                                                   |
| 000022 | 13     | Accounting (COA, journals, bank rec, fiscal periods, FX reval, tax filings)                                                                                                                                                |
| 000023 | 7      | Expenses (categories, advances, expenses, lines, receipts, approvals)                                                                                                                                                      |
| 000024 | 14     | Purchasing (suppliers, RFQs, POs, GRNs, supplier invoices, three-way match)                                                                                                                                                |
| 000025 | 11     | Production + Service Job Tracker (runs, units, costs, landed cost, service jobs, recipes, reconciliations)                                                                                                                 |
| 000026 | 9      | Pricing Engine (rules, floors, scenarios, proposals, history, overrides, pass-through layers)                                                                                                                              |
| 000027 | 13     | Payroll + V2.2 weighted performance appraisal                                                                                                                                                                              |
| 000028 | 8      | Logistics (couriers, deliveries, attempts, proofs, webhooks, POD)                                                                                                                                                          |
| 000029 | 6      | Retail Partners (partners, consignment, settlements)                                                                                                                                                                       |
| 000030 | 6      | Email Campaigns (templates, milestones, campaigns + variants + recipients + events)                                                                                                                                        |
| 000031 | 6      | Retention Bundles (bundles, maintenance plans, workflow rules + executions)                                                                                                                                                |
| 000032 | 6      | Dashboards + V2.2 weekly auto-reports                                                                                                                                                                                      |
| 000033 | —      | Cross-table performance indexes (29)                                                                                                                                                                                       |
| 000034 | —      | Triggers (stock levels, journal balance, journal immutability, invoice/order payment recompute, state history, production roll-up, service job auto-task, document numbering helper)                                       |
| 000035 | —      | Per-brand seed: document numbering, COA, fiscal periods, pipeline, service types, KPIs (40/25/20/15), payroll deductions, locations, expense categories, couriers, email templates, dashboard widgets, V2.2 weekly reports |

### Validation

Full apply cycle tested end-to-end on PostgreSQL 16 + pgvector 0.6:

- 104 shared tables apply cleanly with ON_ERROR_STOP=1
- Both `pixiegirl` and `faitlynhair` schemas provision identically:
  - 158 tables per brand
  - 37 document numbering sequences per brand
  - 87 chart-of-accounts rows
  - 13 fiscal periods (12 monthly + period 13)
  - 5 service types with V2.2 cost + turnaround
  - 4 performance KPIs with weights summing to exactly 100
  - 7 default pipeline stages
  - 4 starter couriers, 12 expense categories, 5 email templates,
    8 dashboard widgets, 2 V2.2 weekly auto-reports

**Total tables across the system: 420 (104 shared + 2 × 158 per brand).**

### V2.2 compliance verified

- ✅ FLH-INV-0001 / PXG-INV-0001 document prefix pattern enforced
- ✅ Service Job Tracker (§6.24) exists in both brand schemas
- ✅ Anti-pocketing partial index on completed jobs with no sale linkage
- ✅ `commission_earned.sale_channel` tracking Instagram/Website/WhatsApp/Walk-in (§6.11)
- ✅ Weighted performance KPIs at 40/25/20/15 (§6.11)
- ✅ Saturday 8 PM weekly Sales + Customer auto-reports (§6.30)
- ✅ Inter-company linkage on sales_orders, invoices, journal_entries, service_jobs

---

## 2026-05-27 — Schema Audit amendments (Option A: in-place edits)

Independent audit confirmed 7 of the 7 gaps + 4 implicit risks identified in
`PixieGirl_Hub_Schema_Audit.md`. All amendments applied in place; no
forward-only patch migrations. Schema re-validated end-to-end.

### Amendments

| ID    | Severity | Where                                | Change                                                                                                                                                                                                                                                                      |
| ----- | -------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | High     | `template/000016`                    | Added `{{BUSINESS}}.storefront_content_posts` for blog / FAQ / Wig Care Guide / lookbook / press posts. Multi-type content stream with SEO fields, structured-data extras, linked products, scheduled publishing                                                            |
| **2** | High     | `template/000016`                    | Added `channel_external_ids JSONB` + `channel_sync_state JSONB` on `product_variants`. GIN index `idx_{{BUSINESS}}_variants_channel_external_ids` for reverse lookup (WooCommerce / Jumia / Amazon bidirectional sync)                                                      |
| **3** | Medium   | `000015`                             | Added `shared.permission_module_keys` Tier-2 reference table seeded with 36 canonical module keys including the previously-missing `'org_workflow'`                                                                                                                         |
| **4** | Medium   | `000012`                             | Added `shared.ai_insight_service_match` table (the seventh Tier-1 insight). Closes the gap where the `insights_service_match` feature flag pointed at no table. Supports 4 alert types: `no_sale_linked`, `no_payment_received`, `no_intercompany_match`, `amount_mismatch` |
| **5** | Low      | —                                    | No change needed. The audit's expected `is_excluded BOOLEAN` already exists as `include_exclude TEXT CHECK (IN ('include','exclude'))` on `sales_campaign_products`. Same semantics; alternative naming. Flagging for backend/frontend awareness.                           |
| **6** | Low      | `template/000031`                    | Extended `retention_workflow_rules.trigger_type` CHECK with `abandoned_cart`, `subscription_renewal_reminder`, `reorder_reminder`, `win_back`. All 8 V2.2 §6.23 automation types now covered (with the prior `cart_abandoned` and `subscription_renewal` kept as aliases)   |
| **7** | Low      | `template/000025`, `template/000034` | Added `port_storage` to `cost_components.cost_type` CHECK list. Updated the production-runs roll-up trigger in template 34 to bucket port_storage into `total_customs_ngn`                                                                                                  |

### Implicit risks resolved

| ID             | Where              | Change                                                                                                                                                                                                                                           |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Implicit-1** | `template/000027`  | Added `last_auto_scored_at`, `last_auto_score_attempt_at`, `last_auto_score_status`, `last_auto_score_error` to `performance_scores`. Auto-score job staleness now detectable from the DB                                                        |
| **Implicit-2** | `000010`, `000015` | Added `shared.timeline_event_codes` canonical dictionary table + 23 seeded standard codes. `order_timeline_events.event_code` now FK-references the dictionary (RESTRICT delete). Prevents "Weaving in Progress" vs "Wig Weaving" type fractures |
| **Implicit-3** | `template/000035`  | Added NSITF row to per-brand `payroll_deductions` seed (1% of payroll, employer obligation per NSITF Act 2010). The CHECK already permitted it; just no seed                                                                                     |
| **Implicit-4** | `000009`           | Made `intercompany_transactions.min_margin_floor_pct` NOT NULL. Investor-protection floor can no longer silently disappear if `business_config.intercompany_settings` wasn't pre-configured                                                      |

### Validation

Full re-build after amendments:

| Layer            | Before  | After                                                                               |
| ---------------- | ------- | ----------------------------------------------------------------------------------- |
| Shared tables    | 104     | **107** (+ai_insight_service_match, +timeline_event_codes, +permission_module_keys) |
| Per-brand tables | 158     | **159** (+storefront_content_posts)                                                 |
| **Total**        | **420** | **425**                                                                             |

All migrations apply cleanly with `ON_ERROR_STOP=1`. Both `pixiegirl` and
`faitlynhair` schemas provision identically. All V2.2 invariants still
verified.

### Frontend / Backend implications

- **Backend team**: 3 new shared tables and 1 new per-brand table need
  CRUD endpoints. `permission_module_keys` is now the canonical source of
  truth for the admin permission matrix UI. `timeline_event_codes` is a
  Tier-1 admin table — owner can extend the customer-facing timeline
  vocabulary without code changes.
- **Frontend team**: New screens needed for (a) Content Posts editor in
  Storefront Studio, (b) Order Timeline Vocabulary editor in Storefront
  Studio settings, (c) Service Match Insights inbox under AI Insights,
  (d) WooCommerce sync status indicator on product variants.
