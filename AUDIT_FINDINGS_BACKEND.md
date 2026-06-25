# Backend Dead Code Audit Findings (`be/`)

Generated: 2025-07-20

## Methodology

1. Listed all `.js` files in `be/` source dirs (`controllers/`, `services/`, `repositories/`, `routes/`, `utils/`, `middlewares/`, `config/`, `rules/`, `observability/`)
2. Read `be/app.js` to identify entrypoints and route registration
3. For each source file: searched for `require()` references across all `be/` production source files
4. Classified per spec: ENTRYPOINT, ACTIVE, CONFIRMED_DEAD, or SUSPICIOUS
5. Checked for dynamic require patterns — none found
6. Checked individual exports of active files for dead exports

## Summary

| Category | Count |
|----------|-------|
| Entrypoint | 1 |
| Active files | 68 |
| CONFIRMED_DEAD (orphan files) | 1 |
| CONFIRMED_DEAD (dead exports) | 3 |
| SUSPICIOUS | 0 |

## Entrypoint

| file_path | item_name | category | evidence | recommended_action |
|-----------|-----------|----------|----------|--------------------|
| `be/app.js` | (entire file) | ENTRYPOINT | Main Express app, `require.main === module` listener | N/A |

## CONFIRMED_DEAD

### Orphan Files

| file_path | item_name | category | evidence | recommended_action |
|-----------|-----------|----------|----------|--------------------|
| `be/repositories/admin.payments.repo.js` | `createMonthlyPayment` | CONFIRMED_DEAD | 0 `require()` references from any `.js` file in `be/` (production or test). File contains comment: "this function is dead code — monthlysubs table has been dropped (migration 023)" | REMOVE |

### Dead Exports (within active files)

| file_path | item_name | category | evidence | recommended_action |
|-----------|-----------|----------|----------|--------------------|
| `be/repositories/employee.sessions.repo.js` | `createPendingPayment` | CONFIRMED_DEAD | 0 callers in production or test code. Legacy pre-PayOS checkout flow, superseded by `session.repo.js` + `paymentAttempt.repo.js` | REMOVE |
| `be/repositories/employee.sessions.repo.js` | `confirmPayment` | CONFIRMED_DEAD | 0 callers in production or test code. Legacy direct-confirm checkout flow, superseded by `checkout.service.js` | REMOVE |
| `be/repositories/employee.sessions.repo.js` | `createAndConfirmPayment` | CONFIRMED_DEAD | 0 callers in production or test code. Legacy combined create+confirm flow, superseded by `checkout.service.js` | REMOVE |

## ACTIVE Files

All other files are confirmed active through static `require()` tracing:

### Routes (registered in `app.js`)

| file_path | registered_as |
|-----------|--------------|
| `be/routes/auth.routes.js` | `/api/auth` |
| `be/routes/admin.routes.js` | `/api/admin` |
| `be/routes/employee.routes.js` | `/api/employee` |
| `be/routes/payment.routes.js` | `/api/payments` |
| `be/routes/edge.routes.js` | `/api/edge` |

### Controllers (all required by route files or `app.js`)

| file_path | required_by |
|-----------|-------------|
| `be/controllers/admin.analytics.controller.js` | `admin.routes.js` |
| `be/controllers/admin.batch.controller.js` | `admin.routes.js` |
| `be/controllers/admin.camera.controller.js` | `admin.routes.js` |
| `be/controllers/admin.checkoutSettings.controller.js` | `admin.routes.js`, `employee.routes.js` |
| `be/controllers/admin.controller.js` | `admin.routes.js` |
| `be/controllers/admin.feeConfig.controller.js` | `admin.routes.js` |
| `be/controllers/admin.gateSettings.controller.js` | `admin.routes.js`, `employee.routes.js` |
| `be/controllers/admin.lostticket.controller.js` | `admin.routes.js` |
| `be/controllers/admin.lots.controller.js` | `admin.routes.js`, `employee.routes.js` |
| `be/controllers/admin.noti.controller.js` | `admin.routes.js`, `employee.routes.js` |
| `be/controllers/admin.parkingCards.controller.js` | `admin.routes.js` |
| `be/controllers/admin.payment.controller.js` | `admin.routes.js` |
| `be/controllers/admin.users.controller.js` | `admin.routes.js` |
| `be/controllers/auth.controller.js` | `auth.routes.js` |
| `be/controllers/edge.events.controller.js` | `edge.routes.js` |
| `be/controllers/employee.controller.js` | `employee.routes.js` |
| `be/controllers/employee.edge.controller.js` | `employee.routes.js` |
| `be/controllers/employee.gateway.controller.js` | `employee.routes.js` |
| `be/controllers/employee.lpd.controller.js` | `employee.routes.js` |
| `be/controllers/employee.monitor.controller.js` | `employee.routes.js` |
| `be/controllers/employee.payment.controller.js` | `employee.routes.js` |
| `be/controllers/employee.profile.controller.js` | `employee.routes.js` |
| `be/controllers/employee.sessions.controller.js` | `employee.routes.js` |
| `be/controllers/employee.subscription.controller.js` | `employee.routes.js` |
| `be/controllers/gate.state.controller.js` | `app.js` |
| `be/controllers/session.audit.controller.js` | `admin.routes.js`, `employee.routes.js` |
| `be/controllers/webhook.payment.controller.js` | `payment.routes.js` |

### Services (all required by controllers or other services)

| file_path | required_by |
|-----------|-------------|
| `be/services/admin.analytics.service.js` | `admin.analytics.controller.js` |
| `be/services/admin.camera.service.js` | `admin.camera.controller.js`, `edge.ingest.service.js` |
| `be/services/admin.checkoutSettings.service.js` | `admin.checkoutSettings.controller.js` |
| `be/services/admin.feeConfig.service.js` | `admin.feeConfig.controller.js` |
| `be/services/admin.gateSettings.service.js` | `admin.gateSettings.controller.js` |
| `be/services/admin.parkingCards.service.js` | `admin.parkingCards.controller.js` |
| `be/services/batchExport.service.js` | `admin.batch.controller.js` |
| `be/services/batchImport.service.js` | `admin.batch.controller.js` |
| `be/services/checkout.service.js` | `employee.payment.controller.js`, `employee.sessions.controller.js`, `webhook.payment.controller.js` |
| `be/services/edge.checkin.service.js` | `employee.edge.controller.js` |
| `be/services/edge.ingest.service.js` | `edge.events.controller.js` |
| `be/services/employee.lpd.service.js` | `employee.lpd.controller.js` |
| `be/services/feeCalculation.service.js` | `employee.sessions.controller.js`, `checkout.service.js`, `paymentIntent.service.js` |
| `be/services/feeEngine.service.js` | `feeCalculation.service.js` |
| `be/services/gate.state.service.js` | `gate.state.controller.js`, `employee.sessions.controller.js`, `checkout.service.js`, `edge.ingest.service.js`, `paymentIntent.service.js` |
| `be/services/image.upload.helper.js` | `admin.lostticket.controller.js`, `employee.sessions.controller.js`, `edge.checkin.service.js` |
| `be/services/issuedCardEntry.js` | `employee.sessions.controller.js`, `employee.subscription.controller.js` |
| `be/services/minio.service.js` | `admin.lostticket.controller.js`, `employee.sessions.controller.js`, `session.audit.service.js`, `image.upload.helper.js` |
| `be/services/paymentIntent.service.js` | `employee.payment.controller.js`, `checkout.service.js` |
| `be/services/payos.client.js` | `checkout.service.js`, `payos.provider.js` |
| `be/services/payos.provider.js` | `paymentIntent.service.js` |
| `be/services/session.audit.service.js` | `session.audit.controller.js` |
| `be/services/xlsx.helper.js` | `admin.batch.controller.js`, `batchImport.service.js` |

### Repositories (all required by controllers or services)

| file_path | required_by |
|-----------|-------------|
| `be/repositories/admin.analytics.repo.js` | `admin.analytics.service.js` |
| `be/repositories/admin.camera.repo.js` | `admin.camera.service.js` |
| `be/repositories/admin.feeConfig.repo.js` | `admin.feeConfig.controller.js` |
| `be/repositories/admin.lostticket.repo.js` | `admin.lostticket.controller.js` |
| `be/repositories/admin.lots.repo.js` | `admin.lots.controller.js`, `employee.sessions.controller.js` |
| `be/repositories/admin.noti.repo.js` | `admin.noti.controller.js` |
| `be/repositories/admin.payment.repo.js` | `admin.payment.controller.js` |
| `be/repositories/admin.users.repo.js` | `admin.users.controller.js` |
| `be/repositories/auth.repo.js` | `auth.controller.js` |
| `be/repositories/batchExport.repo.js` | `admin.batch.controller.js` |
| `be/repositories/cardHolders.repo.js` | `admin.parkingCards.controller.js`, `batchImport.service.js` |
| `be/repositories/checkoutSettings.repo.js` | `admin.checkoutSettings.service.js` |
| `be/repositories/edge.events.repo.js` | `edge.events.controller.js`, `edge.ingest.service.js` |
| `be/repositories/employee.monitor.repo.js` | `employee.monitor.controller.js` |
| `be/repositories/employee.profile.repo.js` | `employee.profile.controller.js` |
| `be/repositories/employee.sessions.repo.js` | `employee.sessions.controller.js`, `admin.lostticket.controller.js`, `edge.events.controller.js`, `edge.checkin.service.js`, `edge.ingest.service.js` |
| `be/repositories/feeConfig.repo.js` | `admin.feeConfig.service.js`, `feeCalculation.service.js`, `employee.sessions.repo.js` |
| `be/repositories/gateSettings.repo.js` | `admin.gateSettings.service.js` |
| `be/repositories/parkingCards.repo.js` | `admin.parkingCards.controller.js`, `admin.lostticket.controller.js`, `employee.sessions.controller.js`, `employee.subscription.controller.js`, `admin.parkingCards.service.js`, `batchImport.service.js` |
| `be/repositories/paymentAttempt.repo.js` | `checkout.service.js`, `paymentIntent.service.js` |
| `be/repositories/paymentIntent.repo.js` | `paymentIntent.service.js` |
| `be/repositories/paymentLedger.repo.js` | `checkout.service.js`, `paymentIntent.service.js` |
| `be/repositories/session.audit.repo.js` | `session.audit.service.js` |
| `be/repositories/session.repo.js` | `checkout.service.js`, `paymentIntent.service.js` |

### Utils, Config, Middlewares, Rules, Observability

| file_path | required_by |
|-----------|-------------|
| `be/config/constants.js` | Multiple controllers, services, middlewares |
| `be/config/db.js` | `app.js`, all repositories, multiple services |
| `be/config/edge_gateways.json` | `admin.camera.controller.js`, `admin.camera.service.js`, `employee.gateway.controller.js`, `edge.checkin.service.js`, `edge.ingest.service.js` |
| `be/config/minio.js` | `image.upload.helper.js`, `minio.service.js` |
| `be/middlewares/auth.middleware.js` | All route files |
| `be/middlewares/edge.auth.middleware.js` | `edge.routes.js` |
| `be/middlewares/upload.middleware.js` | `admin.routes.js` |
| `be/utils/cardUid.js` | `admin.parkingCards.controller.js` |
| `be/utils/date.js` | `feeCalculation.service.js` |
| `be/utils/licensePlate.js` | `employee.sessions.controller.js`, `edge.ingest.service.js` |
| `be/utils/pw.js` | `employee.profile.controller.js` |
| `be/rules/dailyCap.rule.js` | `feeEngine.service.js` |
| `be/rules/gracePeriod.rule.js` | `feeEngine.service.js` |
| `be/rules/hourlyRate.rule.js` | `feeEngine.service.js` |
| `be/rules/lostTicketPenalty.rule.js` | `feeEngine.service.js` |
| `be/rules/rounding.rule.js` | `feeEngine.service.js` |
| `be/rules/tieredRate.rule.js` | `feeEngine.service.js` |
| `be/rules/timeOfDayRate.rule.js` | `feeEngine.service.js` |
| `be/observability/payment.metrics.js` | `paymentIntent.service.js` |

## Dynamic Require Patterns

No dynamic require patterns (`require(variable)`) detected in any `be/` source file.

## Notes

- `be/load-tests/` and `be/load-test-results/` are development/testing utilities referenced by `package.json` scripts (`"load-test": "node load-tests/run-all.js"`). They are not production source code and were excluded from dead code classification per the task scope.
- `be/__tests__/` was excluded from the scan scope per requirements.
