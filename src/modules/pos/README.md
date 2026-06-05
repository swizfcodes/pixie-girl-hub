# Pos module

**Spec:** Point of Sale (V2.2 §6.3)
**Permission key:** `pos`

## Backing tables

- `pos_terminals`
- `pos_sessions`
- `pos_transactions`
- `pos_transaction_splits`
- `pos_cash_drops`
- `pos_void_log`

## Files

| File                | Purpose                              |
| ------------------- | ------------------------------------ |
| `pos.routes.js`     | Express router — URL → controller    |
| `pos.controller.js` | HTTP handlers (req/res only)         |
| `pos.service.js`    | Business logic, transactions, events |
| `pos.repo.js`       | Parameterised SQL only               |
| `pos.validator.js`  | Zod input schemas                    |
| `pos.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/pos/`
- [ ] Add integration tests in `tests/integration/pos/`
