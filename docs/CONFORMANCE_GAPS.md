# V2.2 Conformance Gaps

This document tracks where the current schema and codebase diverge from the V2.2 Product Description, and what each gap needs.

The gaps are organised into three buckets by risk and effort:

## Bucket A — Cheap spec mismatches (≤30 min each)

| ID  | Item                                                                      | Status  |
| --- | ------------------------------------------------------------------------- | ------- |
| A-1 | Loyalty seed thresholds — spec 0/500/2k/5k vs current 0/5k/25k/100k       | PENDING |
| A-2 | Stylist tier names canonical seed: Certified → Pro → Elite                | PENDING |
| A-3 | KPI weights silently summable to ≠100 — need CHECK trigger                | PENDING |
| A-4 | POS idempotency key — `client_idempotency_key` + UNIQUE index             | PENDING |
| A-5 | Wishlist — `shared.customer_wishlists (contact_id, variant_id, added_at)` | PENDING |
| A-6 | `strive_connect` → `opay` in CHECK constraints (legacy spec drift)        | PENDING |
| A-7 | Payment Processing Fees per-gateway per-currency GL accounts              | PENDING |
| A-8 | Cancellation timer defaults verification (3 hrs / 50% custom)             | PENDING |

## Bucket B — Missing spec features (real work)

| ID   | Item                                                                           | Effort                             |
| ---- | ------------------------------------------------------------------------------ | ---------------------------------- |
| B-1  | **Module 6.32 Cash Request & Disbursement** (entire new module)                | ~150 lines SQL + new module folder |
| B-2  | **Installment / `payment_model` paradigm** (layaway / deposit-triggered)       | ~80 lines + abandonment cron       |
| B-3  | **Streak Stars** (Rising/Shining/Supernova/Galaxy + lifetime discount)         | ~120 lines                         |
| B-4  | **Hair Quiz** (visitor-facing, captures lead + Streak Stars)                   | ~50 lines                          |
| B-5  | **UGC ingestion pipeline + self-hosted video** (replaces embeds)               | ~100 lines + FFmpeg job            |
| B-6  | **Public Order Form** (no-login checkout)                                      | ~30 lines + sales_channel CHECK    |
| B-7  | **Storefront analytics tables** (sessions, page views, funnel events)          | ~60 lines                          |
| B-8  | **Curated Delivery Letter + Install QR Hub**                                   | ~20 lines + PDF template           |
| B-9  | **Per-gateway fee config** (Paystack 1.5%/₦2k cap, Opay, Stripe uncapped, ...) | ~20 lines                          |
| B-10 | **E-signature workflow** (or descope to "stored signed PDF")                   | TBD pending decision               |

## Bucket C — Architectural decisions (require CEO/JBS sign-off)

| ID  | Item                                                                                            | Options                                                                                   |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| C-1 | **RLS** — spec explicitly mandates row-level security. Currently app-only on 107 shared tables. | A: implement full RLS (~2 days) · B: descope language · C: hybrid (high-sensitivity only) |
| C-2 | **Field-level privacy** — cost/origin/salary hiding. Currently app-only.                        | A: restricted views + column GRANTs · B: document as app-layer choice                     |
| C-3 | **Soft FKs across schemas** — orphan risk on cross-schema references.                           | A: nightly reconciliation job · B: FK helper function with notify                         |
| C-4 | **Strive Connect drift** — not in V2.2 spec, but in CHECK constraints.                          | A: rip out · B: keep as deprecated                                                        |
| C-5 | **Module count** — spec internally inconsistent (23/26/31/32).                                  | We have 32 in `permission_module_keys`; flag to product                                   |

## Plan of attack

1. Settle Bucket C decisions first (especially C-1 RLS)
2. Apply Bucket A in one validated pass
3. Apply Bucket B in three sub-passes:
   - Pass 1: finance (B-1, B-2, B-9) — must land together
   - Pass 2: retention/storefront (B-3, B-4, B-7)
   - Pass 3: content/customer-facing (B-5, B-6, B-8)
4. Update docs (this file, CHANGELOG, ADMIN_UI, FRONTEND)

Schema delta when all done: **+~15 new tables**, **+~40 columns on existing tables**, **+~5 new CHECK constraints/triggers**, **+~12 new seeds**.

See `migrations/CHANGELOG.md` for what's already shipped.
