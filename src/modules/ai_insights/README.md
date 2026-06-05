# AiInsights module

**Spec:** AI Insights & Briefings (V2.2 §6.30)
**Permission key:** `ai_insights`

## Backing tables

- `ai_insight_stock_alerts`
- `ai_insight_margin_breaches`
- `ai_insight_invoice_alerts`
- `ai_insight_intercompany_alerts`
- `ai_insight_attendance_anomalies`
- `ai_insight_approval_queue_alerts`
- `ai_insight_service_match`
- `ai_briefings`

## Files

| File                     | Purpose                              |
| ------------------------ | ------------------------------------ |
| `insights.routes.js`     | Express router — URL → controller    |
| `insights.controller.js` | HTTP handlers (req/res only)         |
| `insights.service.js`    | Business logic, transactions, events |
| `insights.repo.js`       | Parameterised SQL only               |
| `insights.validator.js`  | Zod input schemas                    |
| `insights.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/ai_insights/`
- [ ] Add integration tests in `tests/integration/ai_insights/`
