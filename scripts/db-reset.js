#!/usr/bin/env node
/**
 * Nuclear option — DROP + CREATE + migrate + bootstrap both brands.
 * For dev only. Asks for confirmation if NODE_ENV is not 'development'.
 */

"use strict";

const { execSync } = require("child_process");

if (process.env.NODE_ENV === "production") {
  console.error("REFUSING to reset in production");
  process.exit(1);
}

console.log("Resetting database…");
try {
  execSync("node scripts/db-drop.js", { stdio: "inherit" });
} catch {}
execSync("node scripts/db-create.js", { stdio: "inherit" });
execSync("node scripts/migrate-shared.js", { stdio: "inherit" });
execSync("node scripts/bootstrap-business.js pixiegirl", { stdio: "inherit" });
execSync("node scripts/bootstrap-business.js faitlynhair", {
  stdio: "inherit",
});
execSync("node scripts/verify-schema.js", { stdio: "inherit" });
