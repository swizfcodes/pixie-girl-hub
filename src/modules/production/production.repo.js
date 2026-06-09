/**
 * Production & Landed Cost (V2.2 §6.24) — repository.
 *
 * production_runs (factory→Lagos→styled), production_run_units, cost_components
 * (trigger `fn_production_run_recompute_totals` rolls these up to the run),
 * and service_jobs (FLH styling; trigger auto-creates a staff task). Per-brand
 * tables via the brand registry `t()`. Parameterised SQL only.
 */

"use strict";

const { query } = require("../../config/database");
const { t } = require("../../config/brands");

const ex = (c) => (c ? c.query.bind(c) : query);

async function nextNumber({ client, brand, type }) {
  const { rows } = await ex(client)(
    `SELECT ${t(brand, "fn_next_document_number")}($1) AS n`,
    [type],
  );
  return rows[0].n;
}

// ── Production runs ────────────────────────────────────────
async function createRun({ client, brand, run }) {
  const { rows } = await ex(client)(
    `INSERT INTO ${t(brand, "production_runs")}
       (run_number, title, status, units_planned)
     VALUES ($1,$2,COALESCE($3,'planned'),COALESCE($4,0)) RETURNING *`,
    [run.run_number, run.title, run.status, run.units_planned],
  );
  return rows[0];
}
async function getRun({ client, brand, id }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "production_runs")} WHERE run_id = $1`,
    [id],
  );
  if (!rows[0]) return null;
  const { rows: units } = await ex(client)(
    `SELECT * FROM ${t(brand, "production_run_units")} WHERE run_id = $1
      ORDER BY unit_code`,
    [id],
  );
  const { rows: components } = await ex(client)(
    `SELECT * FROM ${t(brand, "cost_components")} WHERE run_id = $1
      ORDER BY recorded_at`,
    [id],
  );
  return { ...rows[0], units, components };
}
async function listRuns({ brand, status, page = 1, page_size = 25 }) {
  const where = [];
  const params = [];
  let i = 1;
  if (status) {
    where.push(`status = $${i++}`);
    params.push(status);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows: c } = await query(
    `SELECT count(*)::int AS total FROM ${t(brand, "production_runs")} ${w}`,
    params,
  );
  const offset = (page - 1) * page_size;
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "production_runs")} ${w}
      ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
    [...params, page_size, offset],
  );
  return { data: rows, page, page_size, total: c[0].total };
}
async function setRunStatus({ client, brand, id, status, fields = {} }) {
  const set = ["status = $2"];
  const params = [id, status];
  let i = 3;
  for (const [col, val] of Object.entries(fields)) {
    set.push(`${col} = $${i++}`);
    params.push(val);
  }
  const { rows } = await ex(client)(
    `UPDATE ${t(brand, "production_runs")} SET ${set.join(", ")}, updated_at = now()
      WHERE run_id = $1 RETURNING *`,
    params,
  );
  return rows[0] || null;
}
async function bumpUnitsReceived({ client, brand, id, qty }) {
  const { rows } = await ex(client)(
    `UPDATE ${t(brand, "production_runs")}
        SET units_received = units_received + $2, updated_at = now()
      WHERE run_id = $1 RETURNING *`,
    [id, qty],
  );
  return rows[0] || null;
}

async function addCostComponent({ client, brand, c }) {
  const { rows } = await ex(client)(
    `INSERT INTO ${t(brand, "cost_components")}
       (run_id, cost_type, amount, currency, fx_rate_used, amount_ngn, incurred_at)
     VALUES ($1,$2,$3,$4,COALESCE($5,1),$6,COALESCE($7,CURRENT_DATE)) RETURNING *`,
    [
      c.run_id,
      c.cost_type,
      c.amount,
      c.currency,
      c.fx_rate_used,
      c.amount_ngn,
      c.incurred_at,
    ],
  );
  return rows[0];
}

async function addUnit({ client, brand, unit }) {
  const { rows } = await ex(client)(
    `INSERT INTO ${t(brand, "production_run_units")}
       (unit_code, run_id, variant_id, status)
     VALUES ($1,$2,$3,COALESCE($4,'planned')) RETURNING *`,
    [unit.unit_code, unit.run_id, unit.variant_id || null, unit.status],
  );
  return rows[0];
}

// Service types + service_jobs are owned by the standalone Service Jobs
// module (src/modules/service_jobs).

module.exports = {
  nextNumber,
  createRun,
  getRun,
  listRuns,
  setRunStatus,
  bumpUnitsReceived,
  addCostComponent,
  addUnit,
};
