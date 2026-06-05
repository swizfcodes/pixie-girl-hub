# SalesCampaigns module

**Spec:** Sales Campaigns & Landing Pages (V2.2 §6.22)
**Permission key:** `sales_campaigns`

## Backing tables

- `sales_campaigns`
- `sales_campaign_products`
- `sales_campaign_signups`

## Files

| File                      | Purpose                              |
| ------------------------- | ------------------------------------ |
| `campaigns.routes.js`     | Express router — URL → controller    |
| `campaigns.controller.js` | HTTP handlers (req/res only)         |
| `campaigns.service.js`    | Business logic, transactions, events |
| `campaigns.repo.js`       | Parameterised SQL only               |
| `campaigns.validator.js`  | Zod input schemas                    |
| `campaigns.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/sales_campaigns/`
- [ ] Add integration tests in `tests/integration/sales_campaigns/`
