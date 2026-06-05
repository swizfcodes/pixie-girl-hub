# Pixie Girl Hub — Tables Requiring Admin UI

**Audience:** Backend engineering team building the admin / CEO console.
**Source schema:** `pixiegirl_hub_per_business_templates_complete.zip`
**Stack:** PostgreSQL 16 + pgvector 0.6, Node.js + Express, React PWA admin
**Total tables:** 420 (104 shared + 158 × 2 per-brand)

This document categorises every table in the system by **who edits it and
how often**, so the team knows exactly which tables need admin CRUD UIs
versus which are operational/system-managed.

The guiding principle is: **owners and admins control configuration; the
system records operations.** No configuration is hardcoded in code or
seeded immutably in the database. Every behavior-driving table has an
admin UI behind it.

---

## TIER 1 — Owner / Admin CRUDs (high-flexibility configuration)

These tables drive how the system behaves. **The CEO or designated admin
edits them through admin UIs; no developer touches the code to change
behavior.** Each requires a full CRUD interface (list/view/create/edit/
delete or archive).

### A. Identity & Branding

| Table             | Schema | Purpose                                                                                                                                              | UI Notes                                                                                                           |
| ----------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `business_config` | shared | Brand name, prefix, address, TIN/CAC, mission, logo, loyalty settings, IC settings, cancellation rules, FX settings, **PXG quantity discount rules** | One row per brand. Edit in "Business Setup" (Module 18). The `document_prefix` cannot change after first issuance. |
| `currencies`      | shared | Display currencies (NGN, USD, GBP, EUR, CAD, GHS)                                                                                                    | List + toggle active. Pre-seeded.                                                                                  |
| `bank_accounts`   | shared | Company bank accounts (for AR/AP and reconciliation)                                                                                                 | List/CRUD with masked account numbers.                                                                             |
| `fx_rates`        | shared | FX rates for display currencies (manual override possible)                                                                                           | Often auto-fed from a rate API; admin can override per-day.                                                        |

### B. Organisation & Roles (Module 6.27)

| Table                       | Schema | Purpose                                                                    | UI Notes                                                                                                             |
| --------------------------- | ------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `org_units`                 | shared | Departments, teams                                                         | Hierarchical CRUD.                                                                                                   |
| `org_positions`             | shared | Positions; **solid-line manager**, deputy flag, **approval threshold (₦)** | Drag-and-drop org chart UI. Setting `is_deputy=true` and `approval_threshold_ngn` is the V2.2 Salon Manager pattern. |
| `org_position_dotted_lines` | shared | Dotted-line reporting relationships                                        | Multi-select per position. Info-only (NOT approval).                                                                 |
| `roles`                     | shared | Custom roles per brand (above the 6 system roles)                          | CRUD; cannot edit system roles.                                                                                      |
| `permissions`               | shared | Role × module × action × scope grid                                        | Matrix UI. Module 6.27 RBAC builder.                                                                                 |
| `workflow_definitions`      | shared | Approval flows in JSON (trigger + stages + thresholds + deputy fallback)   | Visual flow builder. Module 6.27.                                                                                    |

### C. Custom Data Shape (Module 18)

| Table                                   | Schema  | Purpose                                                                    | UI Notes                                                                     |
| --------------------------------------- | ------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `custom_field_defs`                     | shared  | Per-brand custom fields on products / contacts / deals / orders / stylists | CRUD per entity type. Defines extensibility.                                 |
| `pipeline_stage_defs`                   | shared  | Generic pipeline-stage configurations                                      | Used as defaults; per-pipeline overrides in `crm_pipeline_stages`.           |
| `tax_rates`                             | shared  | VAT (7.5%), WHT, PAYE, pension, NHF (with effective dates)                 | CRUD with effective_from / effective_to.                                     |
| `document_numbering`                    | shared  | Prefix, padding, next-number per document type                             | List view (read-only `next_number`); edit prefix only before first issuance. |
| `crm_pipelines` + `crm_pipeline_stages` | {brand} | Pipeline structure, stage SLAs, win probabilities, auto-trigger workflows  | Drag-and-drop Kanban-stage builder. Each brand may have multiple pipelines.  |

### D. Geolocation & Staff (Module 6.11.1)

| Table       | Schema | Purpose                                     | UI Notes                                                 |
| ----------- | ------ | ------------------------------------------- | -------------------------------------------------------- |
| `geofences` | shared | Salon/warehouse/HQ named geofences + radius | Map-based UI; admin draws polygon or sets centre+radius. |

### E. Retention Configuration (Module 6.23)

| Table                                     | Schema  | Purpose                                                         | UI Notes                                                |
| ----------------------------------------- | ------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| `loyalty_tiers`                           | shared  | Tier thresholds, multipliers (1×/1.5×/2×/3×), benefits          | CRUD per brand. Multipliers drive earning.              |
| `coupons`                                 | shared  | Coupon codes, % off / ₦ off, validity, usage caps               | CRUD with bulk-generation utility.                      |
| `subscription_plans`                      | shared  | Wig subscription plan definitions                               | CRUD; brand-scoped via `business`.                      |
| `bundle_offers` + `bundle_offer_products` | {brand} | Promotional bundle definitions                                  | Two-table CRUD (header + members).                      |
| `maintenance_plans`                       | {brand} | Salon maintenance subscription plans                            | CRUD; brand-relevant (Faitlyn).                         |
| `retention_workflow_rules`                | {brand} | Post-purchase / reorder reminder / win-back / birthday triggers | Trigger-action builder with conditions JSON.            |
| `email_milestone_rules`                   | {brand} | Birthday / anniversary / tier-upgrade email triggers            | Linked to `email_templates` + optional coupon issuance. |

### F. Storefront Studio (Module 6.28)

| Table                   | Schema | Purpose                                                           | UI Notes                                                            |
| ----------------------- | ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `storefront_themes`     | shared | Theme tokens (colours, typography, logo, buttons) — draft/publish | Visual theme editor. One published + optional draft per brand.      |
| `storefront_pages`      | shared | Page content slots — draft/publish                                | Block-based editor for home / about / contact / lookbook / returns. |
| `storefront_navigation` | shared | Header/footer menus — draft/publish                               | Drag-and-drop menu builder.                                         |

### G. Catalogue (Modules 6.4 / 6.9)

| Table                                                                                 | Schema  | Purpose                                              | UI Notes                                                                                               |
| ------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `product_categories`                                                                  | {brand} | Category tree                                        | Drag-and-drop hierarchy.                                                                               |
| `product_collections` + `product_collection_rules` + `product_collection_members`     | {brand} | Curated + rule-based collections                     | Mode=manual: drag products. Mode=rule: build filter expressions.                                       |
| `products` + `product_variants` + `product_images` + `product_videos` + `product_seo` | {brand} | Full product catalogue with variants                 | Rich product-editor UI; bulk import; wig-specific attributes (texture/lace/length/density/cap/colour). |
| `product_attribute_values`                                                            | {brand} | Extensible custom attributes per `custom_field_defs` | Auto-rendered from field defs.                                                                         |
| `product_related`                                                                     | {brand} | Cross-sell relationships (manual + auto)             | Suggest UI with auto co-purchase data.                                                                 |
| `stock_locations`                                                                     | {brand} | Named storage locations                              | CRUD with map pin.                                                                                     |

### H. Pricing (Module 6.25)

| Table                     | Schema  | Purpose                                                              | UI Notes                              |
| ------------------------- | ------- | -------------------------------------------------------------------- | ------------------------------------- |
| `pricing_rules`           | {brand} | Per-product/channel rules (markup, target margin, fixed price, etc.) | CRUD with priority + scope filters.   |
| `pricing_floors`          | {brand} | Min-margin / min-price floors (incl. **IC min-margin**)              | Set in Pricing Engine UI.             |
| `cost_pass_through_rules` | {brand} | Charm rounding, **PXG quantity-discount layers**                     | Ordered list with config JSONB.       |
| `channel_price_overrides` | {brand} | Manual time-bounded channel overrides                                | List of active overrides with expiry. |

### I. Stylist Partner Programme (Module 6.26)

| Table                    | Schema | Purpose                                    | UI Notes                              |
| ------------------------ | ------ | ------------------------------------------ | ------------------------------------- |
| `stylist_partners`       | shared | Stylist directory + lifecycle              | Master CRUD with capacity management. |
| `stylist_specialities`   | shared | Service catalogue + rate per stylist       | Per-stylist editor.                   |
| `stylist_certifications` | shared | Tiered certifications (Bronze/Silver/Gold) | Award UI with expiry tracking.        |

### J. Marketing & Social (Modules 6.14 / 6.15 / 6.16)

| Table                                         | Schema  | Purpose                                     | UI Notes                                                  |
| --------------------------------------------- | ------- | ------------------------------------------- | --------------------------------------------------------- |
| `social_accounts`                             | shared  | Connected Instagram / FB / TikTok / YouTube | OAuth connect flow + revoke.                              |
| `ad_accounts`                                 | shared  | Connected Google Ads / Meta Ads             | OAuth connect flow + revoke.                              |
| `email_templates`                             | {brand} | Email template library                      | HTML editor; preview with sample variables.               |
| `sales_campaigns` + `sales_campaign_products` | {brand} | Flash sales + landing pages                 | Campaign builder UI (3 states: scheduled / live / ended). |

### K. Purchasing (Module 6.8)

| Table                                                   | Schema  | Purpose                                      | UI Notes                   |
| ------------------------------------------------------- | ------- | -------------------------------------------- | -------------------------- |
| `suppliers` + `supplier_contacts` + `supplier_products` | {brand} | Supplier master + contacts + variant mapping | Three-tab supplier editor. |

### L. Expenses (Module 6.7)

| Table                | Schema  | Purpose                                                           | UI Notes                 |
| -------------------- | ------- | ----------------------------------------------------------------- | ------------------------ |
| `expense_categories` | {brand} | Categories with default GL account + VAT rate + workflow override | CRUD with workflow link. |

### M. Accounting (Module 6.6)

| Table               | Schema  | Purpose                                                                | UI Notes                                                        |
| ------------------- | ------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| `account_groups`    | {brand} | 5 top-level groupings (Assets, Liabilities, Equity, Revenue, Expenses) | Pre-seeded; read-mostly.                                        |
| `chart_of_accounts` | {brand} | The COA (seeded standard Nigerian retail; customisable)                | CRUD with hierarchy. Cannot delete accounts with journal lines. |
| `fiscal_periods`    | {brand} | Period definitions + close state                                       | Auto-generated for the year; admin closes periods manually.     |

### N. POS (Module 6.3)

| Table                 | Schema  | Purpose                           | UI Notes                                    |
| --------------------- | ------- | --------------------------------- | ------------------------------------------- |
| `pos_terminals`       | {brand} | Terminal definitions per location | CRUD with Nomba terminal ID, opening float. |
| `pos_pin_credentials` | {brand} | Staff PIN management              | Set + reset PINs; never display PIN.        |

### O. Production / Service (Module 6.24)

| Table              | Schema  | Purpose                                                                                  | UI Notes                                  |
| ------------------ | ------- | ---------------------------------------------------------------------------------------- | ----------------------------------------- |
| `service_types`    | {brand} | The V2.2 5-item taxonomy + brand-specific additions (cost + turnaround + default recipe) | CRUD; FLH actively uses, PXG keeps empty. |
| `chemical_recipes` | {brand} | Colour Creation recipes (ingredients + instructions)                                     | Visual recipe builder.                    |

### P. Payroll (Module 6.11)

| Table                         | Schema  | Purpose                                                       | UI Notes                                      |
| ----------------------------- | ------- | ------------------------------------------------------------- | --------------------------------------------- |
| `commission_rules`            | {brand} | Commission % per role/product/channel + tiered configs        | Rule builder with priority + scope.           |
| `bonus_rules`                 | {brand} | Bonus definitions including **V2.2 4.8+ rating auto-trigger** | Trigger config JSONB; auto vs manual.         |
| `performance_kpi_definitions` | {brand} | The **weighted KPIs (40/25/20/15 default)**                   | Weights must sum to 100; UI enforces.         |
| `payroll_deductions`          | {brand} | PAYE bands, pension %, NHF                                    | Effective-dated; standard seeded for Nigeria. |
| `performance_cycles`          | {brand} | Appraisal periods (quarterly)                                 | Period setup with bonus pool.                 |

### Q. Logistics (Module 6.10)

| Table      | Schema  | Purpose                                                           | UI Notes                   |
| ---------- | ------- | ----------------------------------------------------------------- | -------------------------- |
| `couriers` | {brand} | Courier definitions (Chowdeck / GIGL / DHL / Manual + rate cards) | CRUD with rate-card JSONB. |

### R. Retail Partners

| Table                                       | Schema  | Purpose                                    | UI Notes                                                 |
| ------------------------------------------- | ------- | ------------------------------------------ | -------------------------------------------------------- |
| `retail_partners` + `consignment_locations` | {brand} | Wholesale partner master + their locations | Partner editor with margin share + settlement frequency. |

### S. Dashboards & Reports (Modules 6.20 / 6.30)

| Table               | Schema  | Purpose                                                                 | UI Notes                                                   |
| ------------------- | ------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `dashboard_configs` | {brand} | Per-user dashboard layouts                                              | Drag-and-drop layout builder.                              |
| `dashboard_widgets` | {brand} | KPI / chart / list widget definitions                                   | System widgets pre-seeded; custom widgets via SQL editor.  |
| `saved_reports`     | {brand} | Saved query/filter definitions                                          | Report builder UI.                                         |
| `report_templates`  | {brand} | Scheduled report templates (incl. V2.2 weekly Sales + Customer reports) | Section editor; cadence picker; staff-confirmation toggle. |

### T. AI Governance (Module 6.31)

| Table                   | Schema | Purpose                                                                                   | UI Notes                                                |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `ai_feature_flags`      | shared | Each AI capability on/off + default model                                                 | Toggle UI; CEO only.                                    |
| `ai_vendor_credentials` | shared | DeepSeek / Groq / OpenAI keys + per-token costs + per-vendor caps                         | Encrypted key entry; rotate button.                     |
| `ai_access_grants`      | shared | Who can use which AI feature (per-user × feature)                                         | Matrix UI.                                              |
| `ai_budget_periods`     | shared | Monthly spend caps (soft + hard)                                                          | Period setup + monitoring panel.                        |
| `ai_action_catalogue`   | shared | What Praxis is allowed to do (auto-generated from OpenAPI; admin gates with `ai_enabled`) | List with bulk enable/disable + min-confidence sliders. |
| `ai_knowledge_chunks`   | shared | RAG corpus (SOPs, training material with access-scope tags)                               | Document upload + chunk preview.                        |

---

## TIER 2 — Bootstrap-seeded, edited rarely

These are seeded by `scripts/bootstrapBusiness.js` with sensible
defaults. Admin can edit (CRUD UI still required) but they typically
don't change after initial setup.

| Table                                 | Seeded with                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `shared.loyalty_tiers`                | Bronze (0 pts) / Silver (5k) / Gold (25k) / Platinum (100k) with multipliers 1×/1.5×/2×/3× |
| `shared.subscription_plans`           | (To be defined by Pixie — placeholder seed)                                                |
| `{brand}.account_groups`              | 5 standard groups                                                                          |
| `{brand}.chart_of_accounts`           | 87 standard Nigerian retail accounts                                                       |
| `{brand}.fiscal_periods`              | 12 months + period 13 for current FY                                                       |
| `{brand}.service_types`               | The V2.2 5-item taxonomy with cost + turnaround                                            |
| `{brand}.performance_kpi_definitions` | 40/25/20/15 weights from V2.2                                                              |
| `{brand}.payroll_deductions`          | Current Nigerian PAYE bands + Pension 8%/10% + NHF 2.5%                                    |
| `{brand}.crm_pipelines` + stages      | 7-stage default sales pipeline                                                             |
| `{brand}.stock_locations`             | "Lagos HQ Warehouse" default                                                               |
| `{brand}.expense_categories`          | 12 standard categories                                                                     |
| `{brand}.couriers`                    | Chowdeck / GIGL / DHL / Manual                                                             |
| `{brand}.email_templates`             | 5 starter templates (welcome, order confirmation, shipped, birthday, abandoned cart)       |
| `{brand}.dashboard_widgets`           | 8 standard KPI widgets                                                                     |
| `{brand}.report_templates`            | V2.2 weekly Sales + Customer reports (Saturday 8 PM)                                       |
| `shared.document_numbering`           | 37 sequences per brand (PXG-INV-0001, FLH-INV-0001, etc.)                                  |

---

## TIER 3 — System data (NOT CRUDed — read-only views only)

These tables are written by the system itself. Admin views them but
**should never have direct CRUD** — editing would break invariants
and audit trails. Read-only screens and filtering UIs only.

### Append-only audit & history (NEVER editable)

- `shared.audit_log` _(database-level UPDATE/DELETE blocked)_
- `shared.loyalty_ledger`
- `shared.intercompany_transactions`
- `shared.intercompany_reconciliations`
- `shared.staff_clock_events`
- `shared.webhook_log`
- `shared.notifications`
- `shared.ai_usage_ledger`
- `shared.ai_usage_daily`
- `shared.ai_messages`
- `shared.ai_run_steps`
- `shared.ai_pending_actions` _(state machine only — confirm/reject UI, not free edit)_
- `shared.storefront_revisions` _(snapshot of every publish event)_
- `shared.order_timeline_events`
- All `{brand}.*_state_history` tables (sales_order_state_history, po_state_history, delivery_state_history, crm_deal_stage_history)
- `{brand}.stock_movements` _(corrections via `stock_adjustments`, never edit ledger)_
- `{brand}.cost_components` _(append-only)_
- `{brand}.landed_cost_breakdown` _(snapshot history)_
- `{brand}.price_history` _(snapshot per change)_
- `{brand}.email_campaign_events` _(provider webhook events)_
- `{brand}.courier_webhook_events`
- `{brand}.retention_workflow_executions`

### Posted financial records (immutable after posting)

- `{brand}.journal_entries` _(immutable when status='posted'; only reversal allowed)_
- `{brand}.journal_lines` _(cannot modify lines on a posted entry; trigger-enforced)_
- `{brand}.account_balances` _(maintained by trigger)_

### Operational records (created by business processes — admin completes, doesn't free-edit)

- `{brand}.sales_orders` _(state machine — admin can change status with workflow, but money figures are locked after payment)_
- `{brand}.sales_order_payments` _(created by payment events; void/refund through proper flows only)_
- `{brand}.invoices` _(once issued, only void allowed)_
- `{brand}.invoice_payments` _(application records; reverse only)_
- `{brand}.credit_notes` _(once issued, void only)_
- `{brand}.receipts` _(generated on payment)_
- `{brand}.pos_transactions` _(created on checkout; void via workflow)_
- `{brand}.pos_sessions` _(open/close lifecycle; reconciliation only)_
- `{brand}.pos_void_log` _(append-only)_
- `{brand}.purchase_orders` _(state machine; immutable after `approved`)_
- `{brand}.goods_received_notes` _(immutable after `posted`)_
- `{brand}.supplier_invoices` _(immutable after match)_
- `{brand}.commission_earned` _(reversal only, not edit)_
- `{brand}.bonuses_awarded` _(approval-only)_
- `{brand}.payslips` _(immutable after `paid`)_
- `{brand}.deliveries` _(state machine + webhook-driven)_
- `{brand}.delivery_attempts` _(append-only)_
- `{brand}.delivery_proofs` _(append-only)_
- `{brand}.pay_on_delivery_collections` _(state machine)_
- `{brand}.production_runs` _(state machine + roll-up from cost_components)_
- `{brand}.production_run_units` _(state machine)_
- `{brand}.service_jobs` _(state machine: pending → in_progress → completed)_
- `{brand}.cancellation_requests` _(submitted → reviewed → executed)_
- `{brand}.bank_statements` + lines + reconciliations _(imported, then matched)_

### Computed/analytics (refreshed by jobs)

- `{brand}.stock_levels` _(materialised from movements)_
- `shared.customer_loyalty_state` _(materialised from ledger)_
- `{brand}.churn_risk_scores` _(computed by cron)_
- `{brand}.email_campaigns.total_*` columns _(rolled from events)_
- `{brand}.sales_campaigns.total_*` columns _(rolled from metrics)_
- `{brand}.monthly_chemical_reconciliations` _(month-end calc)_
- `shared.ai_insight_*` tables _(deterministic rule outputs; admin acknowledges/dismisses but doesn't free-edit)_

---

## Implementation guidance for the backend team

1. **Generate the admin CRUD scaffolding from Tier 1 first.** These are
   the highest-leverage screens.

2. **Tier 1 screens should respect `custom_field_defs`.** A product
   editor must render whatever fields the admin has defined in
   `custom_field_defs` for entity_type='product'.

3. **Tier 2 screens are similar to Tier 1 but with seeded defaults
   pre-populated** — they need editable UIs, just not high-frequency
   ones.

4. **Tier 3 screens are read-only / state-machine-action-only.**
   - View screens: list, detail, search, filter, export
   - Action buttons follow business rules (e.g. "Void" goes through a
     workflow, not a direct edit)
   - Never expose direct `UPDATE`/`DELETE` to these tables from the UI

5. **Audit log every write.** The `shared.audit_log` table is
   append-only (database-enforced). All Tier-1 and Tier-2 CRUD writes
   should insert an audit row.

6. **Permission-aware UI rendering.** Every CRUD screen checks
   `permissions` (module × action × scope) before showing buttons. The
   AI Agent and the API both gate on the same matrix — keep the UI in
   sync.

7. **Workflows route approvals.** When a CRUD action is gated by a
   `workflow_definition` (e.g. price changes > ₦X require CEO
   approval), the UI submits to `workflow_instances` rather than
   directly mutating the target table.

---

## Summary

- **Tier 1 (high-flex):** ~75 tables requiring full admin CRUD UIs
- **Tier 2 (seeded but editable):** ~16 tables with seeded defaults + edit UIs
- **Tier 3 (system / read-only):** ~80+ tables with read/action-only UIs

The remaining tables in the schema are utility / linking tables that
typically don't need their own screens (they surface inside the parent
entity's editor — e.g. `crm_deal_products` appears inside the CRM deal
editor, not its own page).
