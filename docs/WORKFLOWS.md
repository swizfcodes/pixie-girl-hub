# Workflow Engine (V2.2 §6.27)

The workflow engine handles approval routing for any action that isn't simple
yes/no RBAC. It's driven entirely by data in `shared.workflow_definitions` — no
code change is required to reroute an approval. Running state lives in
`shared.workflow_instances`; every approver action is logged in
`shared.workflow_decisions`.

Code:

```
src/workflows/
  conditions.js           pure stage-condition + applicability logic (unit-tested)
  default-definitions.js  the canonical approval set (single source of truth)
  engine.js               persistence, transitions, events, authority
```

## Anatomy of a workflow definition

Authored in the rich §6.27 form or the simpler threshold form below — the
engine normalises both:

```json
{
  "trigger": { "module": "expenses", "action": "submit" },
  "stages": [
    {
      "order": 1,
      "name": "Manager approval (≤ ₦200k)",
      "approvers": [{ "type": "role", "value": "manager" }],
      "threshold_field": "total_ngn",
      "threshold_ngn_lte": 200000,
      "timeout_hours": 48,
      "on_timeout": "escalate",
      "fallback_to_deputy": true
    },
    {
      "order": 2,
      "name": "CEO approval (> ₦200k)",
      "approvers": [{ "type": "role", "value": "ceo" }],
      "threshold_field": "total_ngn",
      "threshold_ngn_gt": 200000,
      "timeout_hours": 48,
      "on_timeout": "escalate"
    }
  ]
}
```

## Threshold routing (the important part)

Each stage carries a **condition** evaluated against the instance `context`.
A stage only runs if its condition holds; non-applicable stages are skipped.
Accepted authored forms (richest wins): canonical `condition` /`applies_when`
(`{ field, gt, gte, lt, lte, eq, in }`), the `threshold_field` +
`threshold_ngn_gt|_gte|_lte|_lt` pair, and the legacy single
`amount_threshold_ngn` (treated as `field ≤ value`).

**Tiers are mutually exclusive.** With the expense definition above:

| Request  | Stage 1 (≤200k) | Stage 2 (>200k) | Routes to |
| -------- | --------------- | --------------- | --------- |
| ₦150,000 | applies         | skipped         | Manager   |
| ₦200,000 | applies (lte)   | skipped         | Manager   |
| ₦250,000 | skipped         | applies         | CEO       |

For a cumulative "manager THEN CEO on large amounts" route, drop the threshold
on stage 1 (so it always applies) and keep `threshold_ngn_gt` on stage 2.

If **no** stage applies (e.g. a value below every threshold), the request needs
no approval: `openInstance` records an immediately-`approved` instance and fires
`workflow.completed`, so the module's completion handler runs through one path.
Services can check `wf.requiresApproval(...)` first to skip opening entirely.

## API

```js
const wf = require("./workflows/engine");

// Does this even need approval, given its amount?
const needs = await wf.requiresApproval({
  business: "pixiegirl",
  trigger_module: "expenses",
  trigger_action: "submit",
  context: { total_ngn: 250000 },
});

// Open an instance — lazily materialises the brand's definition from
// default-definitions.js if none exists yet.
const instance = await wf.openInstance({
  business: "pixiegirl",
  trigger_module: "expenses",
  trigger_action: "submit",
  reference_table: "expenses",
  reference_id: expenseId,
  opened_by: user.user_id,
  context: { total_ngn: 250000 },
});

// Act on the current stage.
await wf.act({
  instance_id: instance.instance_id,
  user: req.user,
  action: "approve", // 'approve' | 'reject' | 'request_changes'
  notes: "Approved with adjustment",
});
```

## Authority

Who may act on a stage (the engine narrows; it never widens):

- `owner`/CEO holder — any stage.
- `role` approver — the acting user must hold that role. `ceo`/`owner` values
  are CEO-only.
- `user` approver — must match the acting user.
- `position` approver — trusted to the route's `org_workflow.approve` grant.

The route still gates the coarse `org_workflow.approve` permission; the engine
adds the fine-grained role/CEO check on top.

## Decisions

- **approve** → advance to the next _applicable_ stage, or complete as
  `approved`.
- **reject** → terminal, status `rejected`.
- **request_changes** → record the decision, send the instance back to its
  first applicable stage (status stays `pending`), emit
  `workflow.changes_requested` so the initiator is notified to edit/resubmit.

## Timeouts, deputy & escalation (continuity)

The sweeper (`jobs/schedulers/workflow-timeout.js`, every 10 min) finds pending
instances past `stage_timeout_at` and applies the current stage's `on_timeout`:

- **escalate** (default) — re-arm the timer + emit `workflow.escalated` to
  re-notify. Never auto-approves money.
- **auto_approve** — system advances/completes (status `timeout_approved`,
  decision `timeout_auto`, `decided_by = NULL`).
- **auto_reject** — terminate (`timeout_rejected`).

`resolveApprover()` routes notifications honouring deputy fallback and CEO
escalation: position holder → its deputy → the `owner`-role holder for the
brand (the CEO is derived from the `owner` role; there is no `is_ceo` column).

## Pending approvals queue + real-time

Mounted on the org router:

| Method | Route                                    | Permission             |
| ------ | ---------------------------------------- | ---------------------- |
| GET    | `/api/v1/org/approvals/pending`          | `org_workflow.view`    |
| GET    | `/api/v1/org/approvals/:instance_id`     | `org_workflow.view`    |
| POST   | `/api/v1/org/approvals/:instance_id/act` | `org_workflow.approve` |
| GET    | `/api/v1/org/workflows`                  | `org_workflow.view`    |
| GET    | `/api/v1/org/workflows/:workflow_id`     | `org_workflow.view`    |
| POST   | `/api/v1/org/workflows`                  | `org_workflow.create`  |
| PATCH  | `/api/v1/org/workflows/:workflow_id`     | `org_workflow.edit`    |

The engine emits `workflow.opened|advanced|changes_requested|escalated|completed`.
`realtime/workflow-realtime.js` fans these into room `brand:<brand>:approvals`
(channels `approval:opened|advanced|changes_requested|escalated|completed`); the
frontend badge refetches the pending queue on any of them.

## The canonical definition set

`src/workflows/default-definitions.js` holds the authored approval routes;
`scripts/seed-workflows.js` (`npm run db:seed:workflows`) materialises them for
every brand in `business_config` (idempotent). The engine also lazily creates a
brand's definition on first trigger if the seed hasn't been run.

| Trigger                  | Route                     | Thresholds                     |
| ------------------------ | ------------------------- | ------------------------------ |
| `expenses:submit`        | Expense Approval          | Manager ≤ ₦200k · CEO > ₦200k  |
| `purchasing:submit`      | Purchase Order Approval   | Manager ≤ ₦500k · CEO > ₦500k  |
| `sales:discount`         | Discount Approval         | Manager ≤ ₦50k · CEO > ₦50k    |
| `sales:cancel`           | Sales Order Cancellation  | Manager (unconditional)        |
| `pricing:change`         | Price Change Approval     | CEO (unconditional)            |
| `intercompany:create`    | Inter-Company Transaction | CEO (unconditional, sensitive) |
| `sales_campaigns:submit` | Campaign Approval         | CEO (unconditional)            |

Cash Request & Disbursement (§6.32) deliberately uses its **own** state machine
(`shared.cash_requests`, threshold `business_config.cash_request_ceo_threshold_ngn`)
and does not route through this engine.

Module reaction: when an instance completes, the originating module's events
wiring subscribes to the engine's `workflow.completed` event and moves its own
record (e.g. expense `pending_approval` → `approved`). The engine does not reach
across module boundaries.
