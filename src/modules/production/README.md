# Production module

**Spec:** Production & Landed Cost (V2.2 §6.24)
**Permission key:** `production`

## Backing tables

- `production_runs`
- `production_run_units`
- `cost_components`
- `landed_cost_breakdown`
- `chemical_recipes`
- `monthly_chemical_reconciliations`
- `funding_sources`

## Files

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `production.routes.js`     | Express router — URL → controller    |
| `production.controller.js` | HTTP handlers (req/res only)         |
| `production.service.js`    | Business logic, transactions, events |
| `production.repo.js`       | Parameterised SQL only               |
| `production.validator.js`  | Zod input schemas                    |
| `production.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/production/`
- [ ] Add integration tests in `tests/integration/production/`
