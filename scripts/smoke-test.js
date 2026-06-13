#!/usr/bin/env node
"use strict";

/**
 * Backend smoke test (BACKEND_COMPLETION_PLAN §1.2).
 *
 * The one end-to-end check the project has never run: boot config, connect to
 * Postgres, and confirm the migrated/bootstrapped schema is actually present
 * and seeded. Run it AFTER:
 *
 *   npm run db:migrate:shared
 *   npm run db:bootstrap:pixiegirl
 *   npm run db:bootstrap:faitlynhair
 *
 * Usage:  node scripts/smoke-test.js     (needs DB_* env, like the app)
 * Exit 0 = all hard checks passed, non-zero = at least one failed.
 *
 * NOTE: run this on real infra or CI — NOT through a sandbox mount that may
 * serve truncated file copies.
 */

require("dotenv").config();

const { config, validateEnv } = require("../src/config/env");
const db = require("../src/config/database");

let hardFailures = 0;
const PASS = "✓";
const FAIL = "✗";
const INFO = "ℹ";

function line(sym, name, detail) {
  // eslint-disable-next-line no-console
  console.log(`  ${sym} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** A hard check: failure counts toward the non-zero exit. */
async function hard(name, fn) {
  try {
    const detail = await fn();
    line(PASS, name, detail);
  } catch (err) {
    hardFailures += 1;
    line(FAIL, name, err.message);
  }
}

/** A soft/informational check: never fails the run. */
async function info(name, fn) {
  try {
    const detail = await fn();
    line(INFO, name, detail);
  } catch (err) {
    line(INFO, name, `(skipped: ${err.message})`);
  }
}

async function tableExists(schema, table) {
  const { rows } = await db.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  if (!rows.length) throw new Error(`${schema}.${table} missing`);
  return `${schema}.${table} present`;
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("\nPixie Girl Hub — backend smoke test\n");

  await hard("environment validates", async () => {
    validateEnv();
    return `NODE_ENV=${config.NODE_ENV}, DB=${config.DB_NAME}@${config.DB_HOST}`;
  });

  await hard("database connects", async () => {
    await db.initDatabase();
    const { rows } = await db.query("SELECT version() AS v");
    return rows[0].v.split(",")[0];
  });

  await hard("shared schema present", async () => {
    const { rows } = await db.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = 'shared'`,
    );
    if (!rows.length)
      throw new Error("schema 'shared' not found — run db:migrate:shared");
    return "ok";
  });

  await hard("core identity tables exist", async () => {
    await tableExists("shared", "users");
    await tableExists("shared", "roles");
    await tableExists("shared", "permissions");
    return "users, roles, permissions";
  });

  await hard("system roles seeded", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM shared.roles WHERE is_system = true`,
    );
    if (rows[0].n < 1)
      throw new Error("no system roles — run db:migrate:shared seed");
    return `${rows[0].n} system roles`;
  });

  // KNOWN GAP (BACKEND_COMPLETION_PLAN §1.3): permission rows are seeded for
  // 'owner' only. This surfaces it instead of hiding it.
  await info("permission grants per role", async () => {
    const { rows } = await db.query(
      `SELECT r.role_name, count(p.*)::int AS grants
         FROM shared.roles r
         LEFT JOIN shared.permissions p ON p.role_id = r.role_id
        WHERE r.is_system = true
        GROUP BY r.role_name
        ORDER BY grants DESC`,
    );
    const ungranted = rows
      .filter((r) => r.grants === 0)
      .map((r) => r.role_name);
    const summary = rows.map((r) => `${r.role_name}:${r.grants}`).join(", ");
    return ungranted.length
      ? `${summary}  [unseeded roles: ${ungranted.join(", ")}]`
      : summary;
  });

  await info("business schemas bootstrapped", async () => {
    const { rows } = await db.query(
      `SELECT schema_name FROM information_schema.schemata
        WHERE schema_name NOT IN ('pg_catalog','information_schema','public','shared')
          AND schema_name NOT LIKE 'pg_%'
        ORDER BY schema_name`,
    );
    if (!rows.length) throw new Error("none — run db:bootstrap:<brand>");
    return rows.map((r) => r.schema_name).join(", ");
  });

  await info("RLS policies installed (entity isolation)", async () => {
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM pg_policies`,
    );
    return `${rows[0].n} policies (read-side enforced only if RLS_READ_ENFORCE=on)`;
  });

  // eslint-disable-next-line no-console
  console.log(
    `\n${hardFailures === 0 ? PASS + " SMOKE PASSED" : FAIL + ` SMOKE FAILED (${hardFailures} hard check(s))`}\n`,
  );
}

main()
  .catch((err) => {
    hardFailures += 1;
    /// eslint-disable-next-line no-console
    console.error("fatal:", err.message);
  })
  .finally(async () => {
    try {
      await db.closeDatabase();
    } catch {
      /* ignore */
    }
    process.exit(hardFailures === 0 ? 0 : 1);
  });
