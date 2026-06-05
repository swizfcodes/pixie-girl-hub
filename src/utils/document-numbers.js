/**
 * Atomic document number generator.
 * Calls the per-business fn_next_document_number() function in the DB,
 * which uses SELECT FOR UPDATE to prevent duplicates under concurrency.
 */

"use strict";

const { query } = require("../config/database");

async function next(brand, documentType) {
  const { rows } = await query(
    `SELECT ${brand}.fn_next_document_number($1) AS number`,
    [documentType],
  );
  return rows[0].number;
}

module.exports = { next };
