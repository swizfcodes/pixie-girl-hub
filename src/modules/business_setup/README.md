# BusinessSetup module

**Spec:** Business Setup (V2.2 §6.21)
**Permission key:** `business_setup`

## Backing tables

- `business_config`
- `currencies`
- `fx_rates`
- `tax_rates`
- `document_numbering`
- `webhook_log`

## Files

| File                           | Purpose                              |
| ------------------------------ | ------------------------------------ |
| `business-setup.routes.js`     | Express router — URL → controller    |
| `business-setup.controller.js` | HTTP handlers (req/res only)         |
| `business-setup.service.js`    | Business logic, transactions, events |
| `business-setup.repo.js`       | Parameterised SQL only               |
| `business-setup.validator.js`  | Zod input schemas                    |
| `business-setup.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/business_setup/`
- [ ] Add integration tests in `tests/integration/business_setup/`
