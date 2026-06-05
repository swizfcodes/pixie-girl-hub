# PraxisAi module

**Spec:** Praxis AI Agent (V2.2 §6.29)
**Permission key:** `praxis_ai`

## Backing tables

- `ai_conversations`
- `ai_messages`
- `ai_run_steps`
- `ai_pending_actions`
- `action_catalogue`

## Files

| File                   | Purpose                              |
| ---------------------- | ------------------------------------ |
| `praxis.routes.js`     | Express router — URL → controller    |
| `praxis.controller.js` | HTTP handlers (req/res only)         |
| `praxis.service.js`    | Business logic, transactions, events |
| `praxis.repo.js`       | Parameterised SQL only               |
| `praxis.validator.js`  | Zod input schemas                    |
| `praxis.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/praxis_ai/`
- [ ] Add integration tests in `tests/integration/praxis_ai/`
