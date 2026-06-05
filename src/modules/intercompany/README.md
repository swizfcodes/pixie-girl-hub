# Intercompany module

**Spec:** Inter-Company Transactions (V2.2 §5.1)
**Permission key:** `intercompany`

## Backing tables

- `intercompany_transactions`
- `intercompany_reconciliations`
- `intercompany_settings`

## Files

| File                         | Purpose                              |
| ---------------------------- | ------------------------------------ |
| `intercompany.routes.js`     | Express router — URL → controller    |
| `intercompany.controller.js` | HTTP handlers (req/res only)         |
| `intercompany.service.js`    | Business logic, transactions, events |
| `intercompany.repo.js`       | Parameterised SQL only               |
| `intercompany.validator.js`  | Zod input schemas                    |
| `intercompany.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/intercompany/`
- [ ] Add integration tests in `tests/integration/intercompany/`
