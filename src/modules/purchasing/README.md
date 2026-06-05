# Purchasing module

**Spec:** Purchasing & Imports (V2.2 §6.8)
**Permission key:** `purchasing`

## Backing tables

- `suppliers`
- `supplier_contacts`
- `rfqs`
- `purchase_orders`
- `goods_received_notes`
- `supplier_invoices`

## Files

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `purchasing.routes.js`     | Express router — URL → controller    |
| `purchasing.controller.js` | HTTP handlers (req/res only)         |
| `purchasing.service.js`    | Business logic, transactions, events |
| `purchasing.repo.js`       | Parameterised SQL only               |
| `purchasing.validator.js`  | Zod input schemas                    |
| `purchasing.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/purchasing/`
- [ ] Add integration tests in `tests/integration/purchasing/`
