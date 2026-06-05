# EmailCampaigns module

**Spec:** Email Campaigns (V2.2 §6.16)
**Permission key:** `email_campaigns`

## Backing tables

- `email_templates`
- `email_milestone_rules`
- `email_campaigns`
- `email_campaign_variants`
- `email_campaign_recipients`
- `email_campaign_events`

## Files

| File                            | Purpose                              |
| ------------------------------- | ------------------------------------ |
| `email-campaigns.routes.js`     | Express router — URL → controller    |
| `email-campaigns.controller.js` | HTTP handlers (req/res only)         |
| `email-campaigns.service.js`    | Business logic, transactions, events |
| `email-campaigns.repo.js`       | Parameterised SQL only               |
| `email-campaigns.validator.js`  | Zod input schemas                    |
| `email-campaigns.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/email_campaigns/`
- [ ] Add integration tests in `tests/integration/email_campaigns/`
