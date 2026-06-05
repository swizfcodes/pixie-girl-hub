# Accounting module

**Spec:** Accounting & Finance (V2.2 §6.6)
**Permission key:** `accounting`

## Backing tables

- `chart_of_accounts`
- `journal_entries`
- `journal_lines`
- `fiscal_periods`
- `bank_statements`
- `bank_reconciliations`
- `tax_filings`

## Files

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `accounting.routes.js`     | Express router — URL → controller    |
| `accounting.controller.js` | HTTP handlers (req/res only)         |
| `accounting.service.js`    | Business logic, transactions, events |
| `accounting.repo.js`       | Parameterised SQL only               |
| `accounting.validator.js`  | Zod input schemas                    |
| `accounting.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/accounting/`
- [ ] Add integration tests in `tests/integration/accounting/`
