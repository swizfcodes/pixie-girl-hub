# Logistics module

**Spec:** Logistics & Delivery (V2.2 §6.10)
**Permission key:** `logistics`

## Backing tables

- `couriers`
- `deliveries`
- `delivery_attempts`
- `delivery_proofs`
- `pay_on_delivery_collections`

## Files

| File                      | Purpose                              |
| ------------------------- | ------------------------------------ |
| `logistics.routes.js`     | Express router — URL → controller    |
| `logistics.controller.js` | HTTP handlers (req/res only)         |
| `logistics.service.js`    | Business logic, transactions, events |
| `logistics.repo.js`       | Parameterised SQL only               |
| `logistics.validator.js`  | Zod input schemas                    |
| `logistics.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/logistics/`
- [ ] Add integration tests in `tests/integration/logistics/`
