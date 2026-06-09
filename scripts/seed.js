#!/usr/bin/env node
/**
 * Application-level seed (separate from per-brand SQL seeds).
 * Creates: initial CEO user, default roles, a sample contact.
 */

"use strict";

const argon2 = require("argon2");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  const initialPassword = process.env.INITIAL_CEO_PASSWORD || "ChangeMeNow!";
  const passwordHash = await argon2.hash(initialPassword);
  await pool.query(
    `INSERT INTO shared.users (email, display_name, password_hash, status, is_ceo)
     VALUES ('ceo@pixiegirlglobal.com', 'Faith (CEO)', $1, 'active', true)
     ON CONFLICT (email) DO NOTHING`,
    [passwordHash],
  );
  console.warn("Seeded CEO user (ceo@pixiegirlglobal.com / see env)");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
