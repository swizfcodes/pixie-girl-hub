# Retention module

**Spec:** Customer Retention & Loyalty + Streak Stars + Hair Quiz (V2.2 §6.23)
**Permission key:** `retention`

## Backing tables

- `loyalty_tiers`
- `loyalty_ledger`
- `customer_loyalty_state`
- `coupons`
- `subscription_plans`
- `subscriptions`
- `bundle_offers`
- `maintenance_plans`
- `maintenance_subscriptions`
- `retention_workflow_rules`
- `retention_workflow_executions`
- `referral_codes`
- `referral_redemptions`

## Files

| File                      | Purpose                              |
| ------------------------- | ------------------------------------ |
| `retention.routes.js`     | Express router — URL → controller    |
| `retention.controller.js` | HTTP handlers (req/res only)         |
| `retention.service.js`    | Business logic, transactions, events |
| `retention.repo.js`       | Parameterised SQL only               |
| `retention.validator.js`  | Zod input schemas                    |
| `retention.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/retention/`
- [ ] Add integration tests in `tests/integration/retention/`
