#!/usr/bin/env node
/**
 * Apply the 15 shared-schema migrations in order.
 *   node scripts/migrate-shared.js
 *
 * These create:
 *   - shared schema with 107 tables (cross-brand identity, contacts,
 *     intercompany, audit, AI, storefront content, etc.)
 *   - All shared triggers + indexes + initial seed data
 *
 * Per-brand schemas are bootstrapped separately via bootstrap-business.js.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

const MIG_DIR = path.join(__dirname, "..", "migrations");

async function main() {
  const client = await pool.connect();
  try {
    const files = fs
      .readdirSync(MIG_DIR)
      .filter((f) => /^\d{6}_.+\.sql$/.test(f))
      .sort();
    console.log(`Applying ${files.length} shared migrations…`);
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIG_DIR, file), "utf-8");
      try {
        await client.query(sql);
        console.log(`  ✓ ${file}`);
      } catch (err) {
        console.error(`  ✗ ${file}: ${err.message}`);
        throw err;
      }
    }
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'shared'`,
    );
    console.log(`\nDone. shared schema has ${rows[0].n} tables.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
