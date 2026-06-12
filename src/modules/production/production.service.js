/**
 * Production & Landed Cost (V2.2 §6.24) — business logic.
 *
 * Production runs: open → advance through the factory→Lagos→styled statuses;
 * cost components append (the DB trigger rolls them up to the run's landed
 * cost); finished units post a `production_in` movement to Stock (SSOT).
 * Service jobs: pending → in_progress → completed (the DB trigger auto-creates
 * a staff task on insert). G-1: a deposit-triggered order opens a styling
 * service job so work begins once the deposit clears.
 */

"use strict";

const repo = require("./production.repo");
const events = require("./production.events");
const stockService = require("../stock/stock.service");
const { audit } = require("../../middleware/audit");
const { transaction } = require("../../config/database");
const { money, toCurrencyString } = require("../../utils/money");
const { NotFoundError, AppError } = require("../../utils/errors");

// The denominator for per-unit landed cost: prefer the most "real" unit count
// available (received → produced → planned), floored at 1 to avoid div-by-zero.
function unitsForCostBasis(run) {
  return run.units_received || run.units_produced || run.units_planned || 1;
}

/**
 * Recompute a run's per-unit landed cost and snapshot it into
 * landed_cost_breakdown (append-only; previous snapshot flips is_latest=false).
 * Reads the trigger-maintained roll-up columns on the run, so it must run AFTER
 * the cost_components insert / run update has committed within the same tx.
 * Idempotent in effect — each call writes a fresh dated snapshot.
 */
async function recomputeLandedCost({ client, brand, id, reason }) {
  const run = await repo.getRunBare({ client, brand, id });
  if (!run) throw new NotFoundError("Production run");

  const units = unitsForCostBasis(run);
  const total = money(run.total_landed_cost_ngn || 0);
  const perUnit = total.div(units);
  const perUnitStr = toCurrencyString(perUnit);

  const prev = await repo.getLatestBreakdown({ client, brand, run_id: id });
  let variancePct = null;
  if (prev && money(prev.per_unit_landed_cost_ngn).gt(0)) {
    const prevPer = money(prev.per_unit_landed_cost_ngn);
    variancePct = Number(
      perUnit.minus(prevPer).div(prevPer).times(100).toFixed(4),
    );
  }

  await repo.markBreakdownsNotLatest({ client, brand, run_id: id });
  const breakdown = await repo.insertBreakdown({
    client,
    brand,
    b: {
      run_id: id,
      computed_reason: reason,
      factory_cost_total_ngn: toCurrencyString(
        money(run.total_factory_cost_ngn || 0),
      ),
      freight_total_ngn: toCurrencyString(money(run.total_freight_ngn || 0)),
      customs_total_ngn: toCurrencyString(money(run.total_customs_ngn || 0)),
      lagos_3pl_total_ngn: toCurrencyString(
        money(run.total_3pl_lagos_ngn || 0),
      ),
      styling_total_ngn: toCurrencyString(money(run.total_styling_ngn || 0)),
      packaging_total_ngn: toCurrencyString(
        money(run.total_packaging_ngn || 0),
      ),
      wastage_total_ngn: toCurrencyString(money(run.total_wastage_ngn || 0)),
      other_total_ngn: toCurrencyString(money(run.total_other_ngn || 0)),
      total_landed_cost_ngn: toCurrencyString(total),
      units_in_run: units,
      per_unit_landed_cost_ngn: perUnitStr,
      weighted_avg_fx_rate: run.effective_funding_rate ?? null,
      funding_currency: run.funding_currency || null,
      variance_from_previous_pct: variancePct,
    },
  });
  await repo.setRunPerUnitCost({
    client,
    brand,
    id,
    per_unit_cost_ngn: perUnitStr,
  });
  events.emit("run.cost_recomputed", {
    brand,
    run_id: id,
    per_unit: perUnitStr,
  });
  return breakdown;
}

// Public wrappers for the recompute (manual refresh + read).
async function refreshLandedCost({ brand, id, reason = "manual_refresh" }) {
  return transaction((client) =>
    recomputeLandedCost({ client, brand, id, reason }),
  );
}
async function getLandedCost({ brand, id }) {
  const run = await repo.getRunBare({ brand, id });
  if (!run) throw new NotFoundError("Production run");
  const [latest, history] = await Promise.all([
    repo.getLatestBreakdown({ brand, run_id: id }),
    repo.listBreakdowns({ brand, run_id: id }),
  ]);
  return { latest, history };
}

const A = (
  brand,
  user,
  action_key,
  target_type,
  target_id,
  after,
  request_id,
) =>
  audit({
    business: brand,
    user_id: user ? user.user_id : null,
    action_key,
    target_type,
    target_id,
    after,
    request_id,
  });

// ── Production runs ────────────────────────────────────────
function listRuns(args) {
  return repo.listRuns(args);
}
async function getRun({ brand, id }) {
  const run = await repo.getRun({ brand, id });
  if (!run) throw new NotFoundError("Production run");
  return run;
}
async function openRun({ brand, user, request_id, input }) {
  return transaction(async (client) => {
    const run_number = await repo.nextNumber({
      client,
      brand,
      type: "production_run",
    });
    const run = await repo.createRun({
      client,
      brand,
      run: {
        run_number,
        title: input.title,
        status: input.status || "planned",
        units_planned: input.units_planned || 0,
      },
    });
    await A(
      brand,
      user,
      "production.run.open",
      "production_run",
      run.run_id,
      { run_number },
      request_id,
    );
    events.emit("run.opened", { brand, run_id: run.run_id });
    return run;
  });
}
async function advanceRun({ brand, user, request_id, id, status }) {
  return transaction(async (client) => {
    const before = await repo.getRun({ client, brand, id });
    if (!before) throw new NotFoundError("Production run");
    const run = await repo.setRunStatus({ client, brand, id, status });
    // Re-snapshot landed cost on milestone state changes — the per-unit basis
    // shifts as the unit count firms up (planned → produced → received).
    await recomputeLandedCost({ client, brand, id, reason: "state_change" });
    await A(
      brand,
      user,
      "production.run.advance",
      "production_run",
      id,
      { from: before.status, to: status },
      request_id,
    );
    events.emit("run.advanced", { brand, run_id: id, status });
    return run;
  });
}
async function addCostComponent({ brand, user, request_id, id, input }) {
  return transaction(async (client) => {
    const run = await repo.getRun({ client, brand, id });
    if (!run) throw new NotFoundError("Production run");
    const amount_ngn =
      input.amount_ngn === undefined || input.amount_ngn === null
        ? toCurrencyString(money(input.amount).times(input.fx_rate_used || 1))
        : input.amount_ngn;
    const c = await repo.addCostComponent({
      client,
      brand,
      c: { ...input, run_id: id, amount_ngn },
    });
    // The fn_production_run_recompute_totals trigger rolls this into the run.
    // With fresh roll-up totals visible in-tx, snapshot the landed cost so the
    // per-unit cost basis (pricing/COGS) tracks every cost added.
    await recomputeLandedCost({ client, brand, id, reason: "new_cost" });
    await A(
      brand,
      user,
      "production.cost.add",
      "cost_component",
      c.component_id,
      { run_id: id, cost_type: c.cost_type },
      request_id,
    );
    events.emit("run.cost_added", { brand, run_id: id });
    return c;
  });
}
async function addUnit({ brand, user, request_id, id, input }) {
  return transaction(async (client) => {
    const run = await repo.getRun({ client, brand, id });
    if (!run) throw new NotFoundError("Production run");
    const seq = (run.units || []).length + 1;
    const unit_code = `${run.run_number}-${String(seq).padStart(3, "0")}`;
    const unit = await repo.addUnit({
      client,
      brand,
      unit: {
        unit_code,
        run_id: id,
        variant_id: input.variant_id,
        status: input.status,
      },
    });
    await A(
      brand,
      user,
      "production.unit.add",
      "production_run_unit",
      unit.unit_id,
      { run_id: id },
      request_id,
    );
    return unit;
  });
}
/**
 * Receive finished goods from a run into stock (production_in movement) and
 * bump the run's received count. Connects production → Stock SSOT.
 */
async function receiveProduction({ brand, user, request_id, id, input }) {
  const run = await repo.getRun({ brand, id });
  if (!run) throw new NotFoundError("Production run");
  if (!input.variant_id || !input.location_id || !input.quantity)
    throw new AppError(
      "INVALID_RECEIPT",
      "variant_id, location_id and quantity are required",
      422,
    );
  await stockService.recordMovement({
    brand,
    user: user || { user_id: null },
    request_id,
    input: {
      variant_id: input.variant_id,
      location_id: input.location_id,
      quantity: Math.abs(input.quantity),
      movement_type: "production_in",
      reference_type: "production_run",
      reference_id: id,
      unit_cost_ngn: input.unit_cost_ngn ?? run.per_unit_cost_ngn ?? null,
    },
  });
  const updated = await repo.bumpUnitsReceived({
    brand,
    id,
    qty: Math.abs(input.quantity),
  });
  events.emit("run.received", { brand, run_id: id, quantity: input.quantity });
  return updated;
}

// ── Rework events (F-7b) ──────────────────────────────────
/**
 * Record a QC rework on a unit. When extra cost is incurred it appends a
 * 'wastage' cost_component (so it rolls into the run's landed cost and the
 * snapshot refreshes), links it to the rework row, and reflects the outcome on
 * the unit (scrapped → rejected, otherwise → reworked).
 */
async function recordRework({ brand, user, request_id, runId, unitId, input }) {
  return transaction(async (client) => {
    const unit = await repo.getUnit({ client, brand, id: unitId });
    if (!unit) throw new NotFoundError("Production unit");
    if (unit.run_id !== runId)
      throw new AppError(
        "UNIT_RUN_MISMATCH",
        "Unit does not belong to this run",
        422,
      );

    const extra = money(input.extra_cost_ngn || 0);
    let cost_component_id = null;
    if (extra.gt(0)) {
      const c = await repo.addCostComponent({
        client,
        brand,
        c: {
          run_id: runId,
          cost_type: "wastage",
          amount: toCurrencyString(extra),
          currency: "NGN",
          fx_rate_used: 1,
          amount_ngn: toCurrencyString(extra),
          incurred_at: input.incurred_at || null,
        },
      });
      cost_component_id = c.component_id;
      // The wastage rolled into the run via the trigger — re-snapshot landed cost.
      await recomputeLandedCost({
        client,
        brand,
        id: runId,
        reason: "new_cost",
      });
    }

    const rework = await repo.insertRework({
      client,
      brand,
      r: {
        unit_id: unitId,
        run_id: runId,
        reason: input.reason,
        qc_finding: input.qc_finding,
        extra_cost_ngn: toCurrencyString(extra),
        cost_component_id,
        delay_days: input.delay_days,
        rework_completed_at: input.rework_completed_at,
        outcome: input.outcome,
        recorded_by: user ? user.user_id : null,
        notes: input.notes,
      },
    });

    const newStatus = input.outcome === "scrapped" ? "rejected" : "reworked";
    await repo.setUnitStatus({ client, brand, id: unitId, status: newStatus });

    await A(
      brand,
      user,
      "production.rework.record",
      "rework_event",
      rework.rework_id,
      { run_id: runId, unit_id: unitId, outcome: input.outcome || null },
      request_id,
    );
    events.emit("run.reworked", { brand, run_id: runId, unit_id: unitId });
    return rework;
  });
}

function listRework({ brand, runId, unitId }) {
  return repo.listRework({ brand, run_id: runId, unit_id: unitId });
}

// Service jobs are owned by the standalone Service Jobs module
// (src/modules/service_jobs). The deposit_met → service-job connection now
// lives in service-jobs.subscribers.

module.exports = {
  listRuns,
  getRun,
  openRun,
  advanceRun,
  addCostComponent,
  addUnit,
  receiveProduction,
  recomputeLandedCost,
  refreshLandedCost,
  getLandedCost,
  recordRework,
  listRework,
};
