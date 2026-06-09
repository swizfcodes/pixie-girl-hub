#!/usr/bin/env node
/**
 * Seed workflow definitions (V2.2 §6.27).
 *
 *   node scripts/seed-workflows.js
 *
 * Materialises every canonical approval definition (src/workflows/
 * default-definitions.js) for EVERY brand present in shared.business_config,
 * so the approval routes exist and show up in the §6.27 Builder list without
 * waiting for a trigger to lazily create them.
 *
 * Idempotent: re-running upserts each definition at version 1, keeping the
 * stored JSONB in sync with the spec. Run AFTER db:migrate:shared and the
 * brand bootstraps (business_config rows must exist).
 *
 * Note: the engine still lazily creates a brand's definition on first trigger
 * if this seed hasn't run — this just front-loads them.
 */

"use strict";

const { Pool } = require("pg");
require("dotenv").config();

const { allSpecs } = require("../src/workflows/default-definitions");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function upsertDefinition(client, business, spec) {
  await client.query(
    `INSERT INTO shared.workflow_definitions
       (business, name, description, trigger_module, trigger_action,
        definition, version, is_active)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, 1, true)
     ON CONFLICT (business, name, version)
     DO UPDATE SET description    = EXCLUDED.description,
                   trigger_module = EXCLUDED.trigger_module,
                   trigger_action = EXCLUDED.trigger_action,
                   definition     = EXCLUDED.definition,
                   is_active      = true,
                   updated_at     = now()`,
    [
      business,
      spec.name,
      spec.description || null,
      spec.trigger_module,
      spec.trigger_action,
      JSON.stringify(spec.definition),
    ],
  );
}

async function main() {
  const specs = allSpecs();
  const client = await pool.connect();
  try {
    const { rows: brands } = await client.query(
      `SELECT business_key FROM shared.business_config ORDER BY business_key`,
    );
    if (brands.length === 0) {
      console.error(
        "No brands in shared.business_config — run the brand bootstraps first.",
      );
      process.exit(1);
    }

    await client.query("BEGIN");
    let count = 0;
    for (const { business_key } of brands) {
      for (const spec of specs) {
        await upsertDefinition(client, business_key, spec);
        count += 1;
      }
    }
    await client.query("COMMIT");

    console.warn(
      `✓ Seeded ${specs.length} workflow definitions × ${brands.length} brand(s) = ${count} rows`,
    );
    for (const { business_key } of brands) {
      console.warn(`  • ${business_key}`);
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Workflow seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
