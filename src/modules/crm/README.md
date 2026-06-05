# Crm module

**Spec:** Customer Management (V2.2 §6.1)
**Permission key:** `crm`

## Backing tables

- `crm_pipelines`
- `crm_pipeline_stages`
- `crm_deals`
- `crm_activities`
- `crm_notes`
- `customer_preferences`
- `customer_measurements`
- `churn_risk_scores`

## Files

| File                | Purpose                              |
| ------------------- | ------------------------------------ |
| `crm.routes.js`     | Express router — URL → controller    |
| `crm.controller.js` | HTTP handlers (req/res only)         |
| `crm.service.js`    | Business logic, transactions, events |
| `crm.repo.js`       | Parameterised SQL only               |
| `crm.validator.js`  | Zod input schemas                    |
| `crm.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/crm/`
- [ ] Add integration tests in `tests/integration/crm/`
