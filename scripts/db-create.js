#!/usr/bin/env node
/**
 * Create the database (run as a superuser).
 *   node scripts/db-create.js
 *
 * Connects to the `postgres` system DB then runs CREATE DATABASE.
 */

"use strict";

const { Client } = require("pg");
require("dotenv").config();

async function main() {
  const dbName = process.env.DB_NAME;
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: "postgres",
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${dbName}`);
    console.warn(`Created database ${dbName}`);
  } catch (err) {
    if (err.code === "42P04") {
      console.warn(`Database ${dbName} already exists`);
    } else {
      throw err;
    }
  }

  // Enable pgvector + citext extensions (run after connecting to the new DB)
  await client.end();
  const dbClient = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: dbName,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await dbClient.connect();
  await dbClient.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await dbClient.query(`CREATE EXTENSION IF NOT EXISTS "citext"`);
  await dbClient.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);
  console.warn("Extensions enabled (pgcrypto, citext, vector)");
  await dbClient.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
