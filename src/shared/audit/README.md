# Audit module

**Spec:** Audit log read-access (V2.2 §3 — append-only)
**Permission key:** `audit`

## Backing tables

- `audit_log`

## Files

| File                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `audit.routes.js`     | Express router — URL → controller    |
| `audit.controller.js` | HTTP handlers (req/res only)         |
| `audit.service.js`    | Business logic, transactions, events |
| `audit.repo.js`       | Parameterised SQL only               |
| `audit.validator.js`  | Zod input schemas                    |
| `audit.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/audit/`
- [ ] Add integration tests in `tests/integration/audit/`
