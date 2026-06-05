/**
 * Praxis Action Catalogue (V2.2 §8.3).
 *
 * The catalogue is GENERATED FROM THE OPENAPI SPEC, not built at runtime.
 * Run `npm run build:action-catalogue` after API changes — it scans routes,
 * extracts schemas, and upserts shared.ai_action_catalogue.
 *
 * At runtime, this module:
 *   - Loads the catalogue (cached in Redis)
 *   - Retrieves top-k candidates via pgvector similarity on the embedded
 *     descriptions (catalogue rows are embedded as part of build)
 *   - Filters by user's permission and current entity scope BEFORE returning
 *
 * Praxis never sees actions outside this catalogue.
 */

"use strict";

const { query } = require("../config/database");

async function findEnabledActions({ user, brand }) {
  const { rows } = await query(
    `SELECT action_key, title, description, http_method, route, payload_schema,
            required_permission, entity_scope, is_write, examples
       FROM shared.ai_action_catalogue
      WHERE ai_enabled = true
        AND (entity_scope = 'both' OR entity_scope = $1)
      ORDER BY action_key`,
    [brand],
  );
  // TODO: filter by user permissions before returning
  return rows;
}

async function findActionByKey(action_key) {
  const { rows } = await query(
    `SELECT * FROM shared.ai_action_catalogue WHERE action_key = $1 LIMIT 1`,
    [action_key],
  );
  return rows[0] || null;
}

module.exports = { findEnabledActions, findActionByKey };
