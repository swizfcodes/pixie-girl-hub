# Sales module

**Spec:** Sales & Quotations + Installment Payments (V2.2 §6.2)
**Permission key:** `sales`

## Backing tables

- `sales_orders`
- `sales_order_lines`
- `sales_order_payments`
- `quotations`
- `cancellation_requests`

## Files

| File                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `sales.routes.js`     | Express router — URL → controller    |
| `sales.controller.js` | HTTP handlers (req/res only)         |
| `sales.service.js`    | Business logic, transactions, events |
| `sales.repo.js`       | Parameterised SQL only               |
| `sales.validator.js`  | Zod input schemas                    |
| `sales.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/sales/`
- [ ] Add integration tests in `tests/integration/sales/`
