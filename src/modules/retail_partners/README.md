# RetailPartners module

**Spec:** Wholesale Retail Partners + Consignment
**Permission key:** `retail_partners`

## Backing tables

- `retail_partners`
- `consignment_locations`
- `consignment_stock`
- `consignment_movements`
- `partner_settlements`
- `partner_settlement_lines`

## Files

| File                     | Purpose                              |
| ------------------------ | ------------------------------------ |
| `partners.routes.js`     | Express router — URL → controller    |
| `partners.controller.js` | HTTP handlers (req/res only)         |
| `partners.service.js`    | Business logic, transactions, events |
| `partners.repo.js`       | Parameterised SQL only               |
| `partners.validator.js`  | Zod input schemas                    |
| `partners.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/retail_partners/`
- [ ] Add integration tests in `tests/integration/retail_partners/`
