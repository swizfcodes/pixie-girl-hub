# Dashboards module

**Spec:** Dashboards & Reports (V2.2 §6.20 + §6.30 weekly reports)
**Permission key:** `dashboards`

## Backing tables

- `dashboard_configs`
- `dashboard_widgets`
- `saved_reports`
- `report_templates`
- `report_runs`
- `report_run_outputs`

## Files

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `dashboards.routes.js`     | Express router — URL → controller    |
| `dashboards.controller.js` | HTTP handlers (req/res only)         |
| `dashboards.service.js`    | Business logic, transactions, events |
| `dashboards.repo.js`       | Parameterised SQL only               |
| `dashboards.validator.js`  | Zod input schemas                    |
| `dashboards.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/dashboards/`
- [ ] Add integration tests in `tests/integration/dashboards/`
