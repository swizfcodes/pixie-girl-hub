# OrgWorkflow module

**Spec:** Organisation & Workflow Builder (V2.2 §6.27)
**Permission key:** `org_workflow`

## Backing tables

- `org_units`
- `org_positions`
- `org_position_dotted_lines`
- `roles`
- `permissions`
- `workflow_definitions`
- `workflow_instances`
- `workflow_step_history`

## Files

| File                | Purpose                              |
| ------------------- | ------------------------------------ |
| `org.routes.js`     | Express router — URL → controller    |
| `org.controller.js` | HTTP handlers (req/res only)         |
| `org.service.js`    | Business logic, transactions, events |
| `org.repo.js`       | Parameterised SQL only               |
| `org.validator.js`  | Zod input schemas                    |
| `org.events.js`     | Domain events for realtime + AI      |

## TODOs

- [ ] Implement repo create/update with real columns
- [ ] Implement validator schemas with actual field definitions
- [ ] Add module-specific endpoints to routes (state transitions, sub-resources)
- [ ] Wire events to Socket.io rooms (see `src/realtime/rooms.js`)
- [ ] Add unit tests in `tests/unit/org_workflow/`
- [ ] Add integration tests in `tests/integration/org_workflow/`
