# HrPayroll module

**Spec:** HR & Payroll (V2.2 §6.11)
**Permission key:** `hr_payroll`

## Backing tables

- `users`
- `staff_profiles`
- `leave_requests`
- `commission_rules`
- `commission_earned`
- `bonus_rules`
- `bonuses_awarded`
- `performance_kpi_definitions`
- `performance_cycles`
- `performance_scores`
- `payroll_runs`
- `payslips`
- `payroll_deductions`

## Files

| File               | Purpose                              |
| ------------------ | ------------------------------------ |
| `hr.routes.js`     | Express router — URL → controller    |
| `hr.controller.js` | HTTP handlers (req/res only)         |
| `hr.service.js`    | Business logic, transactions, events |
| `hr.repo.js`       | Parameterised SQL only               |
| `hr.validator.js`  | Zod input schemas                    |
| `hr.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/hr_payroll/`
- [ ] Add integration tests in `tests/integration/hr_payroll/`
