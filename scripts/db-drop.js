#!/usr/bin/env node
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
  // Force-disconnect any other sessions
  await client.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName],
  );
  await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
  console.log(`Dropped database ${dbName}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
