# Smartcomm module

**Spec:** Messaging Smartcomm (V2.2 §6.17)
**Permission key:** `smartcomm`

## Backing tables

- `comms_threads`
- `comms_messages`

## Files

| File                      | Purpose                              |
| ------------------------- | ------------------------------------ |
| `smartcomm.routes.js`     | Express router — URL → controller    |
| `smartcomm.controller.js` | HTTP handlers (req/res only)         |
| `smartcomm.service.js`    | Business logic, transactions, events |
| `smartcomm.repo.js`       | Parameterised SQL only               |
| `smartcomm.validator.js`  | Zod input schemas                    |
| `smartcomm.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/smartcomm/`
- [ ] Add integration tests in `tests/integration/smartcomm/`
