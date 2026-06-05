/**
 * Workflow Engine (V2.2 §6.27 — Org & Workflow Builder).
 *
 * Workflow definitions live in shared.workflow_definitions as JSON:
 *   {
 *     "trigger": "expense.submitted",
 *     "stages": [
 *       { "step": 1, "role": "manager", "threshold_ngn_lte": 200000, "action": "approve" },
 *       { "step": 2, "role": "ceo",     "threshold_ngn_gt": 200000, "action": "approve" }
 *     ]
 *   }
 *
 * Engine:
 *   - openInstance(definition_id, target_id, target_type, payload)
 *     → returns workflow_instance with status='pending', current_step=1
 *   - act(instance_id, user_id, action='approve'|'reject', notes)
 *     → advances or terminates; emits workflow.advanced / workflow.completed
 *   - resolveApprover(stage, current_position): handles deputy fallback,
 *     dotted-line escalation, vacancy → CEO automatic.
 */

"use strict";

async function openInstance({
  definition_id,
  target_type,
  target_id,
  opened_by,
  payload,
}) {
  throw new Error("TODO: implement workflow openInstance");
}

async function act({ instance_id, user_id, action, notes }) {
  throw new Error("TODO: implement workflow act");
}

async function resolveApprover({ stage, business, current_position_id }) {
  // Look up position holder; if vacant or out-of-office, find deputy;
  // if still nothing, escalate to CEO.
  throw new Error("TODO: implement resolveApprover");
}

module.exports = { openInstance, act, resolveApprover };
