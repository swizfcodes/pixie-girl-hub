# Documents module

**Spec:** Documents & Signatures (V2.2 §6.13)
**Permission key:** `documents`

## Backing tables

- `documents`
- `email_signatures`

## Files

| File                      | Purpose                              |
| ------------------------- | ------------------------------------ |
| `documents.routes.js`     | Express router — URL → controller    |
| `documents.controller.js` | HTTP handlers (req/res only)         |
| `documents.service.js`    | Business logic, transactions, events |
| `documents.repo.js`       | Parameterised SQL only               |
| `documents.validator.js`  | Zod input schemas                    |
| `documents.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/documents/`
- [ ] Add integration tests in `tests/integration/documents/`
