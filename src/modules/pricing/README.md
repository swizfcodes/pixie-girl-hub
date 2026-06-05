# Pricing module

**Spec:** Pricing Engine (V2.2 §6.25)
**Permission key:** `pricing`

## Backing tables

- `pricing_rules`
- `pricing_floors`
- `cost_pass_through_rules`
- `channel_price_overrides`
- `price_proposals`
- `price_history`

## Files

| File                    | Purpose                              |
| ----------------------- | ------------------------------------ |
| `pricing.routes.js`     | Express router — URL → controller    |
| `pricing.controller.js` | HTTP handlers (req/res only)         |
| `pricing.service.js`    | Business logic, transactions, events |
| `pricing.repo.js`       | Parameterised SQL only               |
| `pricing.validator.js`  | Zod input schemas                    |
| `pricing.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/pricing/`
- [ ] Add integration tests in `tests/integration/pricing/`
