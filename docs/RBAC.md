# Role-Based Access Control

V2.2 §3 defines a **five-layer** access model:

1. **Entity isolation** — which company (PXG / FLH) you can see
2. **Module-level** — which modules you can open
3. **Action-level** — within a module, what verbs you can use (view/create/edit/delete/approve/export)
4. **Record-level** — which records you can act on (all / team / own)
5. **Field-level** — within a record, which fields you can see (cost, salary, factory origin hidden from most roles)

## How it lives in the schema

```sql
shared.roles                Role templates (Sales Rep, Manager, CEO, etc.)
shared.user_roles           Users assigned to roles
shared.user_business_access Which brands a user can act on
shared.permissions          (role, module, action, record_scope, allowed)
shared.permission_module_keys  The 36 canonical module keys (org_workflow, sales, ...)
shared.org_positions        Approval thresholds + deputy flags
shared.workflow_definitions Approval routing for actions that need it
```

## How it lives in code

```js
router.post(
  "/orders",
  authMiddleware, // verifies JWT → req.user
  brandContextMiddleware, // resolves req.brand
  requirePermission("sales", "create"), // checks permission, sets req.permission_scope
  validator.validateCreate, // Zod schema
  controller.create,
);
```

The `requirePermission` middleware:

- Bypasses CEO (req.user.is_ceo === true)
- Otherwise looks up permission rows for user's role IDs
- Sets `req.permission_scope` to the most permissive of: 'all' / 'team' / 'own'
- 403s if no grants exist

## Record scope ('own' / 'team') is enforced in the repo

The middleware only knows whether the user has ANY permission at the module × action level. Whether they can act on **this specific record** depends on the record's owner/team — which only the repo can check. So:

```js
async function findById({ brand, id, scope, user_id }) {
  let where = "WHERE order_id = $1";
  const params = [id];
  if (scope === "own") {
    where += " AND created_by = $2";
    params.push(user_id);
  } else if (scope === "team") {
    where += ` AND created_by IN (
      SELECT user_id FROM shared.team_members WHERE team_id IN (
        SELECT team_id FROM shared.team_members WHERE user_id = $2
      )
    )`;
    params.push(user_id);
  }
  // ...
}
```

## Field-level privacy

Currently **app-layer only** (see CONFORMANCE_GAPS.md — H-1 / M-5). Sensitive fields (cost prices, factory origin, salaries) are filtered out in the service layer before response serialisation, based on the user's role. A pending amendment will back this with restricted views + column GRANTs at the DB level.

## CEO bypass

`req.user.is_ceo === true` short-circuits permission checks. The CEO sees everything by design. This is the V2.2 contract — the CEO doesn't need to grant themselves rights, they just have them.

## Workflow-gated actions

Some actions don't have a simple "allowed/denied" — they require an approval workflow. For example:

- Expenses above ₦200,000 require manager approval
- Price changes require CEO approval
- Cash disbursements above ₦20,000 require CEO approval

These are NOT checked in `requirePermission`. Instead, the service layer detects the threshold and opens a `workflow_instance`. The user can submit the request, but it sits in pending until approval. See `WORKFLOWS.md`.
