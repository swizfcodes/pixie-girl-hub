# Contacts module

**Spec:** Contacts & Directory (V2.2 §6.12)
**Permission key:** `contacts`

## Backing tables

- `contacts`
- `contact_segments`
- `addresses`

## Files

| File                     | Purpose                              |
| ------------------------ | ------------------------------------ |
| `contacts.routes.js`     | Express router — URL → controller    |
| `contacts.controller.js` | HTTP handlers (req/res only)         |
| `contacts.service.js`    | Business logic, transactions, events |
| `contacts.repo.js`       | Parameterised SQL only               |
| `contacts.validator.js`  | Zod input schemas                    |
| `contacts.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/contacts/`
- [ ] Add integration tests in `tests/integration/contacts/`
