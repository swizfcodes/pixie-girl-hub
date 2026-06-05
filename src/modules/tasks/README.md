# Tasks module

**Spec:** Tasks & To-Do (V2.2 §6.19)
**Permission key:** `tasks`

## Backing tables

- `tasks`
- `task_subtasks`

## Files

| File                  | Purpose                              |
| --------------------- | ------------------------------------ |
| `tasks.routes.js`     | Express router — URL → controller    |
| `tasks.controller.js` | HTTP handlers (req/res only)         |
| `tasks.service.js`    | Business logic, transactions, events |
| `tasks.repo.js`       | Parameterised SQL only               |
| `tasks.validator.js`  | Zod input schemas                    |
| `tasks.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/tasks/`
- [ ] Add integration tests in `tests/integration/tasks/`
