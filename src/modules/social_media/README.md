# SocialMedia module

**Spec:** Social Media Management (V2.2 §6.14)
**Permission key:** `social`

## Backing tables

- `social_accounts`
- `social_posts`
- `social_post_metrics`

## Files

| File                   | Purpose                              |
| ---------------------- | ------------------------------------ |
| `social.routes.js`     | Express router — URL → controller    |
| `social.controller.js` | HTTP handlers (req/res only)         |
| `social.service.js`    | Business logic, transactions, events |
| `social.repo.js`       | Parameterised SQL only               |
| `social.validator.js`  | Zod input schemas                    |
| `social.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/social_media/`
- [ ] Add integration tests in `tests/integration/social_media/`
