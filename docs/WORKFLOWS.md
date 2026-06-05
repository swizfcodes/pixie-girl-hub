# Workflow Engine (V2.2 §6.27)

The workflow engine handles approval routing for any action that's not simple yes/no RBAC. It's driven entirely by data in `shared.workflow_definitions` — no code change is required to reroute an approval.

## Anatomy of a workflow definition

```json
{
  "workflow_key": "expense_approval",
  "trigger": "expense.submitted",
  "stages": [
    {
      "step": 1,
      "name": "Manager approval (≤ ₦200k)",
      "approver_role": "manager",
      "threshold_field": "total_ngn",
      "threshold_ngn_lte": 200000,
      "action": "approve"
    },
    {
      "step": 2,
      "name": "CEO approval (> ₦200k)",
      "approver_role": "ceo",
      "threshold_field": "total_ngn",
      "threshold_ngn_gt": 200000,
      "action": "approve"
    }
  ],
  "deputy_fallback": true,
  "timeout_hours": 48
}
```

The engine reads the trigger, finds the matching definition, opens an instance, advances through stages based on the payload's actual values, and emits events at every transition.

## API

```js
const wf = require("./workflows/engine");

// Open a new instance — typically called from a service
const instance = await wf.openInstance({
  definition_id: "...",
  target_type: "expense",
  target_id: expenseId,
  opened_by: user.user_id,
  payload: { total_ngn: 250000, business: "pixiegirl" },
});

// Act on a pending stage
await wf.act({
  instance_id: instance.id,
  user_id: req.user.user_id,
  action: "approve",
  notes: "Approved with adjustment",
});

// Resolve the actual person who should approve (handles vacancy, deputy, etc.)
const approver = await wf.resolveApprover({
  stage,
  business: "pixiegirl",
  current_position_id: position.id,
});
```

## Deputy & vacancy handling

V2.2 §6.27 emphasises continuity:

- If the approver's position is **vacant**, the deputy is asked
- If still vacant, **escalate to CEO** automatically
- The CEO can manually **delegate temporarily** (going on leave)

Code reflects this in `resolveApprover()`:

```
position has holder?           → that person
position has deputy?           → that person
direct manager?                → that person
escalate to CEO                → req.user.is_ceo
```

## Pending approvals queue

Each user has a pending approvals view at `/api/v1/org/approvals/pending`. The frontend shows a top-bar badge with the count, polled or via Socket.io room `brand:<brand>:approvals`.

When an approver acts, the engine:

1. Records the action in `shared.workflow_step_history`
2. Advances to the next stage (or terminates if at end)
3. Emits `workflow.advanced` or `workflow.completed`
4. The target module subscribes — e.g., expenses service moves status from 'pending_approval' to 'approved' on completion
