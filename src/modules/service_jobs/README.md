# ServiceJobs module

**Spec:** Faitlyn Service Job Tracker (V2.2 §6.24)
**Permission key:** `service_jobs`

## Backing tables

- `service_types`
- `service_jobs`

## Files

| File                         | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `service-jobs.routes.js`     | Express router — URL → controller    |
| `service-jobs.controller.js` | HTTP handlers (req/res only)         |
| `service-jobs.service.js`    | Business logic, transactions, events |
| `service-jobs.repo.js`       | Parameterised SQL only               |
| `service-jobs.validator.js`  | Zod input schemas                    |
| `service-jobs.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/service_jobs/`
- [ ] Add integration tests in `tests/integration/service_jobs/`
