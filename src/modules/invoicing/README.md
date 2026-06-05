# Invoicing module

**Spec:** Invoicing & Billing (V2.2 §6.5)
**Permission key:** `invoicing`

## Backing tables

- `invoices`
- `invoice_lines`
- `invoice_payments`
- `credit_notes`
- `receipts`
- `invoice_reminders`

## Files

| File                      | Purpose                              |
| ------------------------- | ------------------------------------ |
| `invoicing.routes.js`     | Express router — URL → controller    |
| `invoicing.controller.js` | HTTP handlers (req/res only)         |
| `invoicing.service.js`    | Business logic, transactions, events |
| `invoicing.repo.js`       | Parameterised SQL only               |
| `invoicing.validator.js`  | Zod input schemas                    |
| `invoicing.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/invoicing/`
- [ ] Add integration tests in `tests/integration/invoicing/`
