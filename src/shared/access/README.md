# Access — Identity & Access Administration (V2.2 §3, RBAC)

The admin surface for the RBAC system the `requirePermission` middleware
enforces. Without it the system has only the seeded owner and no way to
onboard anyone else with access.

Mounted at `/api/v1/access`, gated on the `settings` permission. The
owner/CEO bypasses all permission checks.

## Resources

| Area              | Routes                                                      |
| ----------------- | ----------------------------------------------------------- |
| Catalog           | `GET /catalog` — module×action grid for the matrix UI       |
| Roles             | `GET/POST /roles`, `GET/PATCH/DELETE /roles/:role_id`       |
| Permission matrix | `GET/PUT /roles/:role_id/permissions`                       |
| User-role grants  | `GET/POST /users/:user_id/roles`, `DELETE …/roles/:role_id` |
| Brand access      | `GET/PUT /users/:user_id/access`                            |

## Tables

`shared.roles`, `shared.permissions`, `shared.user_roles`,
`shared.users(permitted_businesses, default_business)`.

## Catalog = enforcement vocabulary

`access.catalog.js` lists the **enforced** module keys (the keys routes pass to
`requirePermission`, e.g. `org_workflow`, `sales_campaigns`, `hr_payroll`) — not
the abbreviations in the schema comment. Writing a permission for a module/
action outside the catalog is rejected, so the table can't accumulate keys
nothing checks.

## Escalation guards (`access.guards.js`)

A delegated `settings` admin (not the owner) cannot escalate:

- system roles cannot be deleted by anyone;
- only the owner may modify a system role or its permissions;
- only the owner may grant/revoke the `owner` role;
- the last active owner cannot be revoked (lockout protection).

## Live effect

The RBAC middleware reads `shared.permissions` directly (no cache), so matrix
and grant changes apply on the user's next request.
