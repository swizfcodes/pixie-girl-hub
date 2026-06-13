-- ============================================================
-- force-rls.sql — DELIBERATE §1.4 enablement step (NOT auto-run)
--
-- This is intentionally OUTSIDE the numbered migrations/ sequence so it never
-- applies by accident. Apply it by hand, on STAGING first, only after the
-- cross-brand write-path review (see docs/ENTITY_ISOLATION.md).
--
-- Why: migration 000200 used `ENABLE ROW LEVEL SECURITY`, which the TABLE OWNER
-- bypasses. If the app connects as the same role that ran the migrations (the
-- owner), RLS does nothing. `FORCE ROW LEVEL SECURITY` makes the policy apply to
-- the owner too. (SUPERUSERS still bypass — the app must connect as a
-- non-superuser role regardless.)
--
-- Safe because the brand_isolation policy is permissive-when-unset: a row is
-- visible when the GUC is NULL (workers/crons/CEO cross-brand) OR business = GUC.
-- FORCE only tightens the case where a brand GUC IS set, which is the isolation
-- you want. Validate cross-brand WRITES on staging (WITH CHECK now applies to
-- the owner): every shared-table write must run under the matching brand context
-- (the audit found they do; intercompany uses its own dual-brand policy).
--
-- Apply:    psql "$DATABASE_URL" -f scripts/rls/force-rls.sql
-- Rollback: see the NO FORCE block at the bottom (commented).
-- ============================================================

DO $$
DECLARE
  r RECORD;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace ns ON ns.oid = c.relnamespace
     WHERE ns.nspname = 'shared'
       AND c.relkind = 'r'
       AND c.relrowsecurity = true          -- only tables RLS is already enabled on
       AND c.relforcerowsecurity = false    -- idempotent: skip already-forced
  LOOP
    EXECUTE format('ALTER TABLE shared.%I FORCE ROW LEVEL SECURITY', r.relname);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'FORCE ROW LEVEL SECURITY applied to % shared table(s)', n;
END$$;

-- Verify:
--   SELECT relname, relrowsecurity, relforcerowsecurity
--     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--    WHERE n.nspname = 'shared' AND relrowsecurity = true ORDER BY relname;

-- ── Rollback (uncomment to undo) ────────────────────────────
-- DO $$
-- DECLARE r RECORD;
-- BEGIN
--   FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
--             WHERE ns.nspname='shared' AND c.relkind='r' AND c.relforcerowsecurity = true
--   LOOP EXECUTE format('ALTER TABLE shared.%I NO FORCE ROW LEVEL SECURITY', r.relname); END LOOP;
-- END$$;
