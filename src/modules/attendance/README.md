# Attendance module

**Spec:** Geolocation Clock-In (V2.2 §6.11.1)
**Permission key:** `attendance`

## Backing tables

- `staff_clock_events`
- `geofences`

## Files

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `attendance.routes.js`     | Express router — URL → controller    |
| `attendance.controller.js` | HTTP handlers (req/res only)         |
| `attendance.service.js`    | Business logic, transactions, events |
| `attendance.repo.js`       | Parameterised SQL only               |
| `attendance.validator.js`  | Zod input schemas                    |
| `attendance.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/attendance/`
- [ ] Add integration tests in `tests/integration/attendance/`
