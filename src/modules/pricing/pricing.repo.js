/**
 * Pricing Engine (V2.2 §6.25) — repository.
 *
 * Per-brand tables: pricing_rules, pricing_floors, channel_price_overrides,
 * pricing_scenarios (+ _results, _sliders), price_proposals, price_history,
 * cost_pass_through_rules. Proposal `apply` writes back to product_variants
 * price columns + appends price_history — the connection to the sales spine
 * (sales reads those columns when pricing a line).
 */

"use strict";

const { query } = require("../../config/database");
const { t } = require("../../config/brands");

const ex = (client) => (client ? client.query.bind(client) : query);

// Channel → the product_variants column the engine writes / reads.
const CHANNEL_COLUMN = {
  storefront: "price_storefront_ngn",
  pos: "price_pos_ngn",
  wholesale: "price_wholesale_ngn",
  intercompany: "price_wholesale_ngn",
  partner: "price_partner_ngn",
};

function variantColumn(channel) {
  return CHANNEL_COLUMN[channel] || "price_storefront_ngn";
}

// ── Variant pricing context (cost + current channel prices + floor) ─
async function variantPricing({ client, brand, variant_id }) {
  const { rows } = await ex(client)(
    `SELECT pv.variant_id, pv.sku, pv.variant_name,
            pv.price_storefront_ngn, pv.price_pos_ngn, pv.price_wholesale_ngn,
            pv.price_partner_ngn, pv.compare_at_price_ngn,
            pv.cost_price_ngn, pv.min_price_ngn,
            p.product_id, p.name AS product_name
       FROM ${t(brand, "product_variants")} pv
       JOIN ${t(brand, "products")} p ON p.product_id = pv.product_id
      WHERE pv.variant_id = $1`,
    [variant_id],
  );
  return rows[0] || null;
}

/** Active manual channel override for a variant, if any (most recent). */
async function activeOverride({ client, brand, variant_id, channel }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "channel_price_overrides")}
      WHERE variant_id = $1 AND channel = $2 AND is_active = true
        AND effective_from <= now()
        AND (effective_to IS NULL OR effective_to >= now())
      ORDER BY effective_from DESC
      LIMIT 1`,
    [variant_id, channel],
  );
  return rows[0] || null;
}

/** Active charm/round/pass-through layers for a channel, in apply order. */
async function passThroughLayers({ client, brand, channel }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "cost_pass_through_rules")}
      WHERE is_active = true AND (channel = $1 OR channel = 'all')
      ORDER BY apply_order ASC`,
    [channel],
  );
  return rows;
}

// ── pricing_rules ─────────────────────────────────────────
async function listRules({ brand, channel, is_active }) {
  const where = [];
  const params = [];
  let i = 1;
  if (channel) {
    where.push(`channel = $${i++}`);
    params.push(channel);
  }
  if (is_active !== undefined) {
    where.push(`is_active = $${i++}`);
    params.push(is_active);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "pricing_rules")} ${w} ORDER BY priority ASC, created_at DESC`,
    params,
  );
  return rows;
}
async function createRule({ brand, rule, user_id }) {
  const { rows } = await query(
    `INSERT INTO ${t(brand, "pricing_rules")}
       (rule_name, description, category_id, product_id, variant_id, channel,
        rule_type, rule_value, rule_config, applies_to_currency, priority,
        valid_from, valid_to, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,'{}'::jsonb),$10,
             COALESCE($11,100),COALESCE($12,CURRENT_DATE),$13,$14)
     RETURNING *`,
    [
      rule.rule_name,
      rule.description || null,
      rule.category_id || null,
      rule.product_id || null,
      rule.variant_id || null,
      rule.channel || "storefront",
      rule.rule_type,
      rule.rule_value === undefined || rule.rule_value === null
        ? null
        : rule.rule_value,
      rule.rule_config ? JSON.stringify(rule.rule_config) : null,
      rule.applies_to_currency || null,
      rule.priority === undefined ? null : rule.priority,
      rule.valid_from || null,
      rule.valid_to || null,
      user_id || null,
    ],
  );
  return rows[0];
}
async function findRule({ brand, id }) {
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "pricing_rules")} WHERE rule_id = $1`,
    [id],
  );
  return rows[0] || null;
}
async function updateRule({ brand, id, patch }) {
  const allowed = [
    "rule_name",
    "description",
    "channel",
    "rule_type",
    "rule_value",
    "applies_to_currency",
    "priority",
    "valid_from",
    "valid_to",
    "is_active",
  ];
  const sets = [];
  const params = [];
  let i = 1;
  for (const k of allowed) {
    if (patch[k] !== undefined) {
      sets.push(`${k} = $${i++}`);
      params.push(patch[k]);
    }
  }
  if (patch.rule_config !== undefined) {
    sets.push(`rule_config = $${i++}`);
    params.push(JSON.stringify(patch.rule_config));
  }
  if (!sets.length) return findRule({ brand, id });
  params.push(id);
  const { rows } = await query(
    `UPDATE ${t(brand, "pricing_rules")} SET ${sets.join(", ")}, updated_at = now()
      WHERE rule_id = $${i} RETURNING *`,
    params,
  );
  return rows[0] || null;
}

// ── pricing_floors ────────────────────────────────────────
async function listFloors({ brand, variant_id }) {
  const where = ["is_active = true"];
  const params = [];
  let i = 1;
  if (variant_id) {
    where.push(`variant_id = $${i++}`);
    params.push(variant_id);
  }
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "pricing_floors")} WHERE ${where.join(" AND ")} ORDER BY set_at DESC`,
    params,
  );
  return rows;
}
async function setFloor({ brand, floor, user_id }) {
  const { rows } = await query(
    `INSERT INTO ${t(brand, "pricing_floors")}
       (variant_id, product_id, category_id, channel, floor_type, floor_value,
        reason, is_intercompany_floor, set_by, expires_at)
     VALUES ($1,$2,$3,COALESCE($4,'all'),$5,$6,$7,COALESCE($8,false),$9,$10)
     RETURNING *`,
    [
      floor.variant_id || null,
      floor.product_id || null,
      floor.category_id || null,
      floor.channel || null,
      floor.floor_type,
      floor.floor_value,
      floor.reason || null,
      floor.is_intercompany_floor === undefined
        ? null
        : floor.is_intercompany_floor,
      user_id || null,
      floor.expires_at || null,
    ],
  );
  return rows[0];
}
async function deactivateFloor({ brand, id }) {
  const { rows } = await query(
    `UPDATE ${t(brand, "pricing_floors")} SET is_active = false
      WHERE floor_id = $1 RETURNING floor_id`,
    [id],
  );
  return rows[0] || null;
}
/** Active min-price/margin floors for a variant on a channel. */
async function effectiveFloors({ client, brand, variant_id, channel }) {
  const { rows } = await ex(client)(
    `SELECT floor_type, floor_value FROM ${t(brand, "pricing_floors")}
      WHERE is_active = true AND variant_id = $1
        AND (channel = $2 OR channel = 'all')
        AND (expires_at IS NULL OR expires_at >= now())`,
    [variant_id, channel],
  );
  return rows;
}

// ── channel_price_overrides ───────────────────────────────
async function listOverrides({ brand, variant_id }) {
  const where = [];
  const params = [];
  let i = 1;
  if (variant_id) {
    where.push(`variant_id = $${i++}`);
    params.push(variant_id);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "channel_price_overrides")} ${w} ORDER BY effective_from DESC`,
    params,
  );
  return rows;
}
async function setOverride({ brand, override, user_id }) {
  const { rows } = await query(
    `INSERT INTO ${t(brand, "channel_price_overrides")}
       (variant_id, channel, override_price_ngn, reason, effective_from,
        effective_to, approved_by, created_by)
     VALUES ($1,$2,$3,$4,COALESCE($5,now()),$6,$7,$8)
     RETURNING *`,
    [
      override.variant_id,
      override.channel,
      override.override_price_ngn,
      override.reason,
      override.effective_from || null,
      override.effective_to || null,
      override.approved_by || null,
      user_id || null,
    ],
  );
  return rows[0];
}
async function deactivateOverride({ brand, id }) {
  const { rows } = await query(
    `UPDATE ${t(brand, "channel_price_overrides")} SET is_active = false
      WHERE override_id = $1 RETURNING override_id`,
    [id],
  );
  return rows[0] || null;
}

// ── pricing_scenarios ─────────────────────────────────────
async function createScenario({ brand, sc, user_id }) {
  const { rows } = await query(
    `INSERT INTO ${t(brand, "pricing_scenarios")}
       (scenario_name, description, scope_type, category_ids, variant_ids,
        goal_type, goal_value, goal_currency, channel, assumed_monthly_units,
        cost_basis, custom_cost_ngn, created_by)
     VALUES ($1,$2,COALESCE($3,'specific_variants'),COALESCE($4,'{}'),COALESCE($5,'{}'),
             $6,$7,$8,COALESCE($9,'storefront'),$10,COALESCE($11,'latest'),$12,$13)
     RETURNING *`,
    [
      sc.scenario_name,
      sc.description || null,
      sc.scope_type || null,
      sc.category_ids || null,
      sc.variant_ids || null,
      sc.goal_type,
      sc.goal_value === undefined ? null : sc.goal_value,
      sc.goal_currency || null,
      sc.channel || null,
      sc.assumed_monthly_units === undefined ? null : sc.assumed_monthly_units,
      sc.cost_basis || null,
      sc.custom_cost_ngn === undefined ? null : sc.custom_cost_ngn,
      user_id || null,
    ],
  );
  return rows[0];
}
async function listScenarios({ brand, status }) {
  const where = [];
  const params = [];
  let i = 1;
  if (status) {
    where.push(`status = $${i++}`);
    params.push(status);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "pricing_scenarios")} ${w} ORDER BY created_at DESC`,
    params,
  );
  return rows;
}
async function findScenario({ client, brand, id }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "pricing_scenarios")} WHERE scenario_id = $1`,
    [id],
  );
  return rows[0] || null;
}
async function scenarioResults({ brand, scenario_id }) {
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "pricing_scenario_results")} WHERE scenario_id = $1`,
    [scenario_id],
  );
  return rows;
}
async function scenarioSliders({ brand, scenario_id }) {
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "pricing_scenario_sliders")}
      WHERE scenario_id = $1 ORDER BY display_order ASC`,
    [scenario_id],
  );
  return rows;
}
async function replaceSliders({ client, brand, scenario_id, sliders }) {
  await ex(client)(
    `DELETE FROM ${t(brand, "pricing_scenario_sliders")} WHERE scenario_id = $1`,
    [scenario_id],
  );
  for (let idx = 0; idx < sliders.length; idx++) {
    const s = sliders[idx];
    await ex(client)(
      `INSERT INTO ${t(brand, "pricing_scenario_sliders")}
         (scenario_id, slider_key, baseline_value, scenario_value, notes, display_order)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        scenario_id,
        s.slider_key,
        s.baseline_value,
        s.scenario_value,
        s.notes || null,
        idx,
      ],
    );
  }
}
async function clearScenarioResults({ client, brand, scenario_id }) {
  await ex(client)(
    `DELETE FROM ${t(brand, "pricing_scenario_results")} WHERE scenario_id = $1`,
    [scenario_id],
  );
}
async function insertScenarioResult({ client, brand, r }) {
  const { rows } = await ex(client)(
    `INSERT INTO ${t(brand, "pricing_scenario_results")}
       (scenario_id, variant_id, cost_ngn, current_price_ngn, current_margin_pct,
        proposed_price_ngn, proposed_margin_pct, proposed_markup_pct,
        margin_at_cost_minus_10, margin_at_cost_plus_10,
        margin_at_fx_minus_10, margin_at_fx_plus_10,
        floor_breached, floor_breach_notes,
        projected_monthly_units, projected_monthly_revenue_ngn)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      r.scenario_id,
      r.variant_id,
      r.cost_ngn,
      r.current_price_ngn,
      r.current_margin_pct,
      r.proposed_price_ngn,
      r.proposed_margin_pct,
      r.proposed_markup_pct,
      r.margin_at_cost_minus_10,
      r.margin_at_cost_plus_10,
      r.margin_at_fx_minus_10,
      r.margin_at_fx_plus_10,
      r.floor_breached,
      r.floor_breach_notes || null,
      r.projected_monthly_units || null,
      r.projected_monthly_revenue_ngn || null,
    ],
  );
  return rows[0];
}
async function updateScenarioComputed({ client, brand, scenario_id, agg }) {
  const { rows } = await ex(client)(
    `UPDATE ${t(brand, "pricing_scenarios")}
        SET status = 'computed', computed_at = now(),
            computed_units_analysed = $2,
            computed_avg_new_price_ngn = $3,
            computed_avg_margin_pct = $4,
            computed_projected_revenue_ngn = $5,
            updated_at = now()
      WHERE scenario_id = $1 RETURNING *`,
    [
      scenario_id,
      agg.units_analysed,
      agg.avg_new_price_ngn,
      agg.avg_margin_pct,
      agg.projected_revenue_ngn,
    ],
  );
  return rows[0];
}
async function setScenarioStatus({
  client,
  brand,
  scenario_id,
  status,
  proposal_id,
}) {
  const { rows } = await ex(client)(
    `UPDATE ${t(brand, "pricing_scenarios")}
        SET status = $2, price_proposal_id = COALESCE($3, price_proposal_id), updated_at = now()
      WHERE scenario_id = $1 RETURNING *`,
    [scenario_id, status, proposal_id || null],
  );
  return rows[0] || null;
}

// ── variants in a scenario scope ──────────────────────────
async function variantsInScope({
  brand,
  scope_type,
  category_ids,
  variant_ids,
}) {
  if (scope_type === "specific_variants") {
    if (!variant_ids || !variant_ids.length) return [];
    const { rows } = await query(
      `SELECT pv.variant_id, pv.cost_price_ngn, pv.price_storefront_ngn, pv.min_price_ngn
         FROM ${t(brand, "product_variants")} pv
        WHERE pv.variant_id = ANY($1::uuid[]) AND COALESCE(pv.is_deleted,false) = false`,
      [variant_ids],
    );
    return rows;
  }
  if (scope_type === "category") {
    const { rows } = await query(
      `SELECT pv.variant_id, pv.cost_price_ngn, pv.price_storefront_ngn, pv.min_price_ngn
         FROM ${t(brand, "product_variants")} pv
         JOIN ${t(brand, "products")} p ON p.product_id = pv.product_id
        WHERE p.category_id = ANY($1::uuid[]) AND COALESCE(pv.is_deleted,false) = false`,
      [category_ids || []],
    );
    return rows;
  }
  // all_active
  const { rows } = await query(
    `SELECT pv.variant_id, pv.cost_price_ngn, pv.price_storefront_ngn, pv.min_price_ngn
       FROM ${t(brand, "product_variants")} pv
      WHERE COALESCE(pv.is_deleted,false) = false`,
  );
  return rows;
}

// ── price_proposals ───────────────────────────────────────
async function nextProposalNumber({ client, brand }) {
  const { rows } = await ex(client)(
    `SELECT ${t(brand, "fn_next_document_number")}('price_proposal') AS n`,
  );
  return rows[0].n;
}
async function createProposal({ client, brand, p }) {
  const { rows } = await ex(client)(
    `INSERT INTO ${t(brand, "price_proposals")}
       (proposal_number, scenario_id, title, description, effective_from,
        effective_to, variants_count, status, submitted_by, submitted_at)
     VALUES ($1,$2,$3,$4,COALESCE($5,CURRENT_DATE),$6,COALESCE($7,0),
             'pending_approval',$8,now())
     RETURNING *`,
    [
      p.proposal_number,
      p.scenario_id || null,
      p.title,
      p.description || null,
      p.effective_from || null,
      p.effective_to || null,
      p.variants_count === undefined ? null : p.variants_count,
      p.submitted_by || null,
    ],
  );
  return rows[0];
}
async function listProposals({ brand, status }) {
  const where = [];
  const params = [];
  let i = 1;
  if (status) {
    where.push(`status = $${i++}`);
    params.push(status);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "price_proposals")} ${w} ORDER BY created_at DESC`,
    params,
  );
  return rows;
}
async function findProposal({ client, brand, id }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "price_proposals")} WHERE proposal_id = $1`,
    [id],
  );
  return rows[0] || null;
}
async function setProposalStatus({ client, brand, id, status, fields = {} }) {
  const sets = ["status = $2"];
  const params = [id, status];
  let i = 3;
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = $${i++}`);
    params.push(v);
  }
  const { rows } = await ex(client)(
    `UPDATE ${t(brand, "price_proposals")} SET ${sets.join(", ")}, updated_at = now()
      WHERE proposal_id = $1 RETURNING *`,
    params,
  );
  return rows[0] || null;
}

// ── variant write-back + price_history ────────────────────
async function applyVariantPrice({
  client,
  brand,
  variant_id,
  channel,
  new_price_ngn,
  min_price_ngn,
}) {
  const col = variantColumn(channel);
  const sets = [`${col} = $2`];
  const params = [variant_id, new_price_ngn];
  let i = 3;
  if (min_price_ngn !== undefined && min_price_ngn !== null) {
    sets.push(`min_price_ngn = $${i++}`);
    params.push(min_price_ngn);
  }
  const { rows } = await ex(client)(
    `UPDATE ${t(brand, "product_variants")} SET ${sets.join(", ")}, updated_at = now()
      WHERE variant_id = $1 RETURNING variant_id, ${col} AS new_price`,
    params,
  );
  return rows[0] || null;
}
async function insertPriceHistory({ client, brand, h }) {
  const { rows } = await ex(client)(
    `INSERT INTO ${t(brand, "price_history")}
       (variant_id, channel, old_price_ngn, new_price_ngn, delta_pct,
        cost_at_change_ngn, margin_at_change_pct, source, proposal_id,
        effective_from, changed_by, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,now()),$11,$12)
     RETURNING history_id`,
    [
      h.variant_id,
      h.channel,
      h.old_price_ngn,
      h.new_price_ngn,
      h.delta_pct,
      h.cost_at_change_ngn,
      h.margin_at_change_pct,
      h.source,
      h.proposal_id || null,
      h.effective_from || null,
      h.changed_by || null,
      h.notes || null,
    ],
  );
  return rows[0];
}
async function priceHistory({ brand, variant_id, limit = 50 }) {
  const { rows } = await query(
    `SELECT * FROM ${t(brand, "price_history")}
      WHERE variant_id = $1 ORDER BY effective_from DESC LIMIT $2`,
    [variant_id, limit],
  );
  return rows;
}
async function historyByProposal({ client, brand, proposal_id }) {
  const { rows } = await ex(client)(
    `SELECT * FROM ${t(brand, "price_history")}
      WHERE proposal_id = $1 ORDER BY created_at ASC`,
    [proposal_id],
  );
  return rows;
}

module.exports = {
  variantColumn,
  variantPricing,
  activeOverride,
  passThroughLayers,
  listRules,
  createRule,
  updateRule,
  findRule,
  listFloors,
  setFloor,
  deactivateFloor,
  effectiveFloors,
  listOverrides,
  setOverride,
  deactivateOverride,
  createScenario,
  listScenarios,
  findScenario,
  scenarioResults,
  scenarioSliders,
  replaceSliders,
  clearScenarioResults,
  insertScenarioResult,
  updateScenarioComputed,
  setScenarioStatus,
  variantsInScope,
  nextProposalNumber,
  createProposal,
  listProposals,
  findProposal,
  setProposalStatus,
  applyVariantPrice,
  insertPriceHistory,
  priceHistory,
  historyByProposal,
};
