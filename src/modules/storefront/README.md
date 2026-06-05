# Storefront module

**Spec:** E-Commerce Storefront & Channel Sync (V2.2 §6.4)
**Permission key:** `storefront`

## Backing tables

- `storefront_pages`
- `storefront_themes`
- `storefront_content_posts`
- `carts`
- `product_videos`

## Files

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `storefront.routes.js`     | Express router — URL → controller    |
| `storefront.controller.js` | HTTP handlers (req/res only)         |
| `storefront.service.js`    | Business logic, transactions, events |
| `storefront.repo.js`       | Parameterised SQL only               |
| `storefront.validator.js`  | Zod input schemas                    |
| `storefront.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/storefront/`
- [ ] Add integration tests in `tests/integration/storefront/`
