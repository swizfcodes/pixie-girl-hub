# Expenses module

**Spec:** Expense Management (V2.2 §6.7)
**Permission key:** `expenses`

## Backing tables

- `expenses`
- `expense_lines`
- `expense_categories`
- `cash_advances`

## Files

| File                     | Purpose                              |
| ------------------------ | ------------------------------------ |
| `expenses.routes.js`     | Express router — URL → controller    |
| `expenses.controller.js` | HTTP handlers (req/res only)         |
| `expenses.service.js`    | Business logic, transactions, events |
| `expenses.repo.js`       | Parameterised SQL only               |
| `expenses.validator.js`  | Zod input schemas                    |
| `expenses.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/expenses/`
- [ ] Add integration tests in `tests/integration/expenses/`
