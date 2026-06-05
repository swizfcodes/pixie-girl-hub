# Stock module

**Spec:** Stock SSOT (V2.2 §6.9)
**Permission key:** `stock`

## Backing tables

- `stock_locations`
- `stock_movements`
- `stock_levels`
- `stock_alerts`
- `stock_adjustments`
- `stock_transfers`
- `inbound_shipments`

## Files

| File                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `stock.routes.js`     | Express router — URL → controller    |
| `stock.controller.js` | HTTP handlers (req/res only)         |
| `stock.service.js`    | Business logic, transactions, events |
| `stock.repo.js`       | Parameterised SQL only               |
| `stock.validator.js`  | Zod input schemas                    |
| `stock.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/stock/`
- [ ] Add integration tests in `tests/integration/stock/`
