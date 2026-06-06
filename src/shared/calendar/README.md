# Calendar module

**Spec:** Calendar & Scheduling (V2.2 §6.18)
**Permission key:** `calendar`

## Backing tables

- `calendar_events`
- `calendar_event_participants`
- `calendar_resources`

## Files

| File                     | Purpose                              |
| ------------------------ | ------------------------------------ |
| `calendar.routes.js`     | Express router — URL → controller    |
| `calendar.controller.js` | HTTP handlers (req/res only)         |
| `calendar.service.js`    | Business logic, transactions, events |
| `calendar.repo.js`       | Parameterised SQL only               |
| `calendar.validator.js`  | Zod input schemas                    |
| `calendar.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/calendar/`
- [ ] Add integration tests in `tests/integration/calendar/`
