/**
 * Workflow Engine (V2.2 §6.27 — Org & Workflow Builder).
 *
 * Data-driven approval routing. Definitions live in
 * shared.workflow_definitions (JSONB stages); running state in
 * shared.workflow_instances; the per-approver log in
 * shared.workflow_decisions. No compiled matrix — the engine reads the
 * definition at request time.
 *
 * Public API (all accept an optional `client` to run inside a caller's tx):
 *   - findDefinition({ business, trigger_module, trigger_action })
 *   - openInstance({ business, trigger_module, trigger_action,
 *                    reference_table, reference_id, opened_by, context })
 *       → inserts an instance at stage 1 (status 'pending'); lazily
 *         creates a default definition if the brand has none, so the
 *         module is usable before Module 6.27's builder UI exists.
 *   - findOpenInstance({ business, reference_table, reference_id })
 *   - act({ instance_id, user, action: 'approve'|'reject', notes })
 *       → records the decision, advances or terminates, returns the
 *         updated instance ({ status, current_stage, ... }).
 *   - resolveApprover({ business, stage, current_position_id })
 *       → best-effort "who should approve" for notifications, honouring
 *         deputy fallback and CEO escalation.
 *
 * Authority rule: a stage approver of {type:'role', value:'ceo'} requires
 * the acting user to be the CEO. Any other approver type trusts that the
 * calling route already enforced the module's `approve` RBAC grant (the
 * engine never widens access — it only narrows for the CEO-only case).
 */

"use strict";

const { EventEmitter } = require("events");
const { query, transaction } = require("../config/database");
const { AppError } = require("../utils/errors");

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

// Built-in defaults used when a brand has no authored definition yet.
const DEFAULT_SPECS = {
  "sales_campaigns:submit": {
    name: "Campaign Approval (default)",
    description: "Default single-stage CEO approval for sales campaigns.",
    definition: {
      trigger: { module: "sales_campaigns", action: "submit" },
      stages: [
        {
          order: 1,
          approvers: [{ type: "role", value: "ceo" }],
          timeout_hours: 48,
          on_timeout: "escalate",
          fallback_to_deputy: true,
        },
      ],
    },
  },
};

function execFor(client) {
  return client ? client.query.bind(client) : query;
}

/**
 * Normalise a definition's stages to a stable internal shape regardless
 * of whether they were authored in the rich §6.27 form or the simpler
 * WORKFLOWS.md form.
 */
function normaliseStages(definition) {
  const raw = (definition && definition.stages) || [];
  return raw
    .map((s, idx) => {
      const approvers =
        s.approvers ||
        (s.approver_role
          ? [{ type: "role", value: s.approver_role }]
          : [{ type: "role", value: "ceo" }]);
      return {
        order: s.order || s.step || idx + 1,
        approvers,
        amount_threshold_ngn:
          s.amount_threshold_ngn ?? s.threshold_ngn_lte ?? null,
        timeout_hours: s.timeout_hours ?? 48,
        on_timeout: s.on_timeout || "escalate",
        fallback_to_deputy: s.fallback_to_deputy === true,
      };
    })
    .sort((a, b) => a.order - b.order);
}

async function findDefinition({
  client,
  business,
  trigger_module,
  trigger_action,
}) {
  const exec = execFor(client);
  const { rows } = await exec(
    `SELECT * FROM shared.workflow_definitions
      WHERE business = $1 AND trigger_module = $2 AND trigger_action = $3
        AND is_active = true
      ORDER BY version DESC
      LIMIT 1`,
    [business, trigger_module, trigger_action],
  );
  return rows[0] || null;
}

/** Lazily create the built-in default definition for a trigger. */
async function ensureDefaultDefinition({
  client,
  business,
  trigger_module,
  trigger_action,
  opened_by,
}) {
  const existing = await findDefinition({
    client,
    business,
    trigger_module,
    trigger_action,
  });
  if (existing) return existing;

  const spec = DEFAULT_SPECS[`${trigger_module}:${trigger_action}`];
  if (!spec) {
    throw new AppError(
      "WORKFLOW_NOT_CONFIGURED",
      `No workflow definition for ${trigger_module}.${trigger_action}`,
      409,
    );
  }
  const exec = execFor(client);
  const { rows } = await exec(
    `INSERT INTO shared.workflow_definitions
       (business, name, description, trigger_module, trigger_action, definition, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (business, name, version) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [
      business,
      spec.name,
      spec.description,
      trigger_module,
      trigger_action,
      JSON.stringify(spec.definition),
      opened_by || null,
    ],
  );
  return rows[0];
}

async function openInstance({
  client,
  business,
  trigger_module,
  trigger_action,
  reference_table,
  reference_id,
  opened_by,
  context = {},
}) {
  const def = await ensureDefaultDefinition({
    client,
    business,
    trigger_module,
    trigger_action,
    opened_by,
  });
  const stages = normaliseStages(def.definition);
  const first = stages[0];
  const timeoutHours = first ? first.timeout_hours : 48;

  const exec = execFor(client);
  const { rows } = await exec(
    `INSERT INTO shared.workflow_instances
       (workflow_id, business, reference_table, reference_id, current_stage,
        status, context, initiated_by, stage_entered_at, stage_timeout_at)
     VALUES ($1, $2, $3, $4, 1, 'pending', $5::jsonb, $6, now(), now() + ($7 || ' hours')::interval)
     RETURNING *`,
    [
      def.workflow_id,
      business,
      reference_table,
      reference_id,
      JSON.stringify(context),
      opened_by,
      String(timeoutHours),
    ],
  );
  const instance = rows[0];
  emitter.emit("workflow.opened", { instance });
  return instance;
}

async function findOpenInstance({
  client,
  business,
  reference_table,
  reference_id,
}) {
  const exec = execFor(client);
  const { rows } = await exec(
    `SELECT * FROM shared.workflow_instances
      WHERE business = $1 AND reference_table = $2 AND reference_id = $3
        AND status = 'pending'
      ORDER BY initiated_at DESC
      LIMIT 1`,
    [business, reference_table, reference_id],
  );
  return rows[0] || null;
}

function userCanActOnStage(stage, user) {
  if (user && user.is_ceo) return true;
  // Only the CEO-only constraint is enforced here; other approver types
  // trust the route's RBAC `approve` gate.
  const requiresCeo = (stage.approvers || []).some(
    (a) => a.type === "role" && a.value === "ceo",
  );
  return !requiresCeo;
}

async function act({ client, instance_id, user, action, notes }) {
  if (!["approve", "reject"].includes(action)) {
    throw new AppError("INVALID_ACTION", `Unknown workflow action ${action}`, 400);
  }

  const run = async (c) => {
    const exec = c.query.bind(c);
    const { rows: instRows } = await exec(
      `SELECT * FROM shared.workflow_instances WHERE instance_id = $1 FOR UPDATE`,
      [instance_id],
    );
    const instance = instRows[0];
    if (!instance)
      throw new AppError("NOT_FOUND", "Workflow instance not found", 404);
    if (instance.status !== "pending") {
      throw new AppError(
        "WORKFLOW_CLOSED",
        `Instance already ${instance.status}`,
        409,
      );
    }

    const { rows: defRows } = await exec(
      `SELECT * FROM shared.workflow_definitions WHERE workflow_id = $1`,
      [instance.workflow_id],
    );
    const stages = normaliseStages(defRows[0] && defRows[0].definition);
    const stage = stages[instance.current_stage - 1];
    if (!stage)
      throw new AppError("WORKFLOW_STAGE_MISSING", "Stage not found", 409);

    if (!userCanActOnStage(stage, user)) {
      throw new AppError(
        "PERMISSION_DENIED",
        "This approval stage requires the CEO",
        403,
      );
    }

    await exec(
      `INSERT INTO shared.workflow_decisions
         (instance_id, stage_number, decided_by, decision, comments)
       VALUES ($1, $2, $3, $4, $5)`,
      [instance_id, instance.current_stage, user.user_id, action, notes || null],
    );

    let updated;
    if (action === "reject") {
      const r = await exec(
        `UPDATE shared.workflow_instances
            SET status = 'rejected', completed_at = now()
          WHERE instance_id = $1 RETURNING *`,
        [instance_id],
      );
      updated = r.rows[0];
      emitter.emit("workflow.completed", {
        instance: updated,
        status: "rejected",
      });
      return updated;
    }

    // approve
    const isFinal = instance.current_stage >= stages.length;
    if (isFinal) {
      const r = await exec(
        `UPDATE shared.workflow_instances
            SET status = 'approved', completed_at = now()
          WHERE instance_id = $1 RETURNING *`,
        [instance_id],
      );
      updated = r.rows[0];
      emitter.emit("workflow.completed", {
        instance: updated,
        status: "approved",
      });
    } else {
      const next = stages[instance.current_stage]; // next stage (0-indexed)
      const r = await exec(
        `UPDATE shared.workflow_instances
            SET current_stage = current_stage + 1,
                stage_entered_at = now(),
                stage_timeout_at = now() + ($2 || ' hours')::interval
          WHERE instance_id = $1 RETURNING *`,
        [instance_id, String(next ? next.timeout_hours : 48)],
      );
      updated = r.rows[0];
      emitter.emit("workflow.advanced", { instance: updated });
    }
    return updated;
  };

  // Reuse the caller's tx if provided, else open our own.
  if (client) return run(client);
  return transaction(run);
}

/**
 * Best-effort resolution of who should approve the current stage, for
 * notification routing. Honours deputy fallback and CEO escalation.
 */
async function resolveApprover({ client, business, stage, current_position_id }) {
  const exec = execFor(client);
  const wantsCeo = (stage.approvers || []).some(
    (a) => a.type === "role" && a.value === "ceo",
  );

  const ceoLookup = async () => {
    const { rows } = await exec(
      `SELECT u.user_id, u.display_name
         FROM shared.users u
         JOIN shared.user_business_access uba ON uba.user_id = u.user_id
        WHERE u.is_ceo = true AND uba.business_key = $1 AND u.status = 'active'
        LIMIT 1`,
      [business],
    );
    return rows[0] || null;
  };

  if (wantsCeo) {
    const ceo = await ceoLookup();
    if (ceo) return { kind: "ceo", ...ceo };
  }

  if (current_position_id) {
    const { rows } = await exec(
      `SELECT position_id, profile_id, reports_to_position_id, is_deputy
         FROM shared.org_positions WHERE position_id = $1`,
      [current_position_id],
    );
    const pos = rows[0];
    if (pos && pos.profile_id) return { kind: "position", ...pos };
    if (pos) {
      const { rows: dep } = await exec(
        `SELECT position_id, profile_id FROM shared.org_positions
          WHERE reports_to_position_id = $1 AND is_deputy = true AND profile_id IS NOT NULL
          LIMIT 1`,
        [pos.reports_to_position_id],
      );
      if (dep[0]) return { kind: "deputy", ...dep[0] };
    }
  }

  const ceo = await ceoLookup();
  return ceo ? { kind: "ceo_escalation", ...ceo } : null;
}

function onWorkflowEvent(eventType, handler) {
  emitter.on(eventType, handler);
}

module.exports = {
  findDefinition,
  openInstance,
  findOpenInstance,
  act,
  resolveApprover,
  onWorkflowEvent,
  emitter,
  normaliseStages, // exported for tests
};
