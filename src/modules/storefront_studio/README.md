# StorefrontStudio module

**Spec:** Storefront Studio (V2.2 §6.28)
**Permission key:** `storefront_studio`

## Backing tables

- `storefront_themes`
- `storefront_pages`
- `storefront_navigation`
- `storefront_revisions`

## Files

| File                   | Purpose                              |
| ---------------------- | ------------------------------------ |
| `studio.routes.js`     | Express router — URL → controller    |
| `studio.controller.js` | HTTP handlers (req/res only)         |
| `studio.service.js`    | Business logic, transactions, events |
| `studio.repo.js`       | Parameterised SQL only               |
| `studio.validator.js`  | Zod input schemas                    |
| `studio.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/storefront_studio/`
- [ ] Add integration tests in `tests/integration/storefront_studio/`
