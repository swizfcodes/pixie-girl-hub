# Marketing module

**Spec:** Marketing Campaigns & Ad Analytics (V2.2 §6.15)
**Permission key:** `ad_analytics`

## Backing tables

- `ad_accounts`
- `ad_campaigns`

## Files

| File                      | Purpose                              |
| ------------------------- | ------------------------------------ |
| `marketing.routes.js`     | Express router — URL → controller    |
| `marketing.controller.js` | HTTP handlers (req/res only)         |
| `marketing.service.js`    | Business logic, transactions, events |
| `marketing.repo.js`       | Parameterised SQL only               |
| `marketing.validator.js`  | Zod input schemas                    |
| `marketing.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/marketing/`
- [ ] Add integration tests in `tests/integration/marketing/`
