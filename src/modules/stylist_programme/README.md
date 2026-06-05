# StylistProgramme module

**Spec:** Stylist Partner Programme (V2.2 §6.26)
**Permission key:** `stylist_programme`

## Backing tables

- `stylist_partners`
- `stylist_specialities`
- `stylist_certifications`
- `stylist_assignments`
- `stylist_payouts`

## Files

| File                    | Purpose                              |
| ----------------------- | ------------------------------------ |
| `stylist.routes.js`     | Express router — URL → controller    |
| `stylist.controller.js` | HTTP handlers (req/res only)         |
| `stylist.service.js`    | Business logic, transactions, events |
| `stylist.repo.js`       | Parameterised SQL only               |
| `stylist.validator.js`  | Zod input schemas                    |
| `stylist.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/stylist_programme/`
- [ ] Add integration tests in `tests/integration/stylist_programme/`
