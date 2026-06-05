-- ============================================================
-- MIGRATION 000001 — Schemas, roles, extensions, shared functions
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- Run this FIRST — everything else depends on it.
--
-- Note: V2 hardcodes ONLY the `shared` schema. Per-business
--       schemas (pixiegirl, faitlynhair, and any future brands)
--       are created dynamically by scripts/bootstrapBusiness.js
--       using the per-business migration templates.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";      -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fuzzy text search on names/SKUs
CREATE EXTENSION IF NOT EXISTS "vector";      -- pgvector: local RAG for Praxis AI Agent (Module 6.29)
                                              -- Install on the DB server first:
                                              --   sudo apt install postgresql-16-pgvector
                                              -- or build from https://github.com/pgvector/pgvector

-- ── Shared schema (the only hardcoded one) ───────────────
CREATE SCHEMA IF NOT EXISTS shared;

-- ── Application roles ────────────────────────────────────
-- hub_app is the role the Node.js server connects as.
-- Never connect as superuser from the application.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hub_app') THEN
    CREATE ROLE hub_app LOGIN PASSWORD 'CHANGE_THIS_IN_ENV';
  END IF;
END $$;

-- hub_auditor: INSERT-only on audit_log
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hub_auditor') THEN
    CREATE ROLE hub_auditor LOGIN PASSWORD 'CHANGE_THIS_IN_ENV_2';
  END IF;
END $$;

-- hub_reporter: read-only across all schemas
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hub_reporter') THEN
    CREATE ROLE hub_reporter LOGIN PASSWORD 'CHANGE_THIS_IN_ENV_3';
  END IF;
END $$;

-- hub_stylist: stylist portal role (scoped to shared.stylist_* only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hub_stylist') THEN
    CREATE ROLE hub_stylist LOGIN PASSWORD 'CHANGE_THIS_IN_ENV_4';
  END IF;
END $$;

-- hub_storefront: anonymous storefront role (read public catalogue,
-- write carts/cart_items only). Per-business schema grants are added
-- by the bootstrap script when each business schema is created.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'hub_storefront') THEN
    CREATE ROLE hub_storefront LOGIN PASSWORD 'CHANGE_THIS_IN_ENV_5';
  END IF;
END $$;

-- ── Shared schema grants ─────────────────────────────────
GRANT USAGE ON SCHEMA shared TO hub_app, hub_auditor, hub_reporter, hub_stylist, hub_storefront;

ALTER DEFAULT PRIVILEGES IN SCHEMA shared
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared
  GRANT INSERT ON TABLES TO hub_auditor;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared
  GRANT SELECT ON TABLES TO hub_reporter;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared
  GRANT USAGE, SELECT ON SEQUENCES TO hub_app;

-- ── Shared utility functions ─────────────────────────────

-- Generic updated_at bumper used by virtually every table.
CREATE OR REPLACE FUNCTION shared.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Validate a schema identifier before bootstrap composes dynamic SQL.
-- Refuses anything that isn't ^[a-z][a-z0-9_]{1,30}$ — the bootstrap
-- script must call this before substituting into any template.
CREATE OR REPLACE FUNCTION shared.fn_is_safe_identifier(p_ident TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN p_ident ~ '^[a-z][a-z0-9_]{1,30}$'
     AND p_ident NOT IN ('shared','public','pg_catalog','information_schema');
END;
$$;

-- ============================================================
-- Verify
-- SELECT schema_name FROM information_schema.schemata
-- WHERE schema_name = 'shared';
-- Expected: 1 row
-- ============================================================
