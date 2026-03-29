# PayOS Payment Intent Redesign

## Goal

Standardize checkout payment flow around a Payment Intent domain model so each checkout session has exactly one active intent at any moment, while preserving provider attempt history and making webhook handling replay-safe.

## Domain Model

### PaymentIntent (primary business entity)

- Exactly one active intent per `session_id`
- Tracks payment lifecycle independent of provider retries
- Owns active checkout state shown to frontend

State machine:

- `REQUIRES_PAYMENT_METHOD` -> `PENDING` -> `PAID`
- `REQUIRES_PAYMENT_METHOD` -> `PENDING` -> `CANCELED`
- `REQUIRES_PAYMENT_METHOD` -> `PENDING` -> `EXPIRED`

### PaymentAttempt (provider call history)

- Child of intent (`intent_id` FK)
- Records each provider request/response attempt
- Multiple attempts per intent allowed

State machine:

- `CREATED` -> `PENDING` -> `PAID`
- `CREATED` -> `PENDING` -> `FAILED`
- `CREATED` -> `PENDING` -> `EXPIRED`
- `CREATED` -> `PENDING` -> `SUPERSEDED`

## Database Changes

Starting point: current schema around `db/init/003_payment_attempts.sql`.

Additions:

1. New table: `payment_intents`
   - `intent_id` (PK)
   - `session_id` (FK -> `parkingsessions.session_id`)
   - `status` (`REQUIRES_PAYMENT_METHOD`, `PENDING`, `PAID`, `CANCELED`, `EXPIRED`)
   - `active_attempt_id` (nullable FK -> `payment_attempts.attempt_id`)
   - `amount`, `currency`, `provider`, `expires_at`
   - `idempotency_key` metadata (for create/resume semantics)
   - `created_at`, `updated_at`

2. Alter `payment_attempts`
   - Add `intent_id` (FK -> `payment_intents.intent_id`)
   - Keep `provider_order_code` as provider id mapping key

3. Indexes/constraints
   - Unique partial index: only one active intent per session
     - active statuses: `REQUIRES_PAYMENT_METHOD`, `PENDING`
   - Unique index for provider order code where non-null
   - Supporting indexes for `intent_id`, `session_id`, and status lookups

## Concurrency and Idempotency

### Race-condition protection

- Use transaction + `SELECT ... FOR UPDATE` on target intent row (or session-scoped lock) during create/resume/regenerate.
- Ensure active-intent invariant cannot be broken under concurrent requests.

### Idempotency key strategy (chosen)

- Scope: **per user action** (new key per explicit create/regenerate click).
- Backend stores and checks key in intent workflow to dedupe retries of the same action (double-click/network retry) without suppressing intentional regenerate.

## Service Architecture

Refactor `be/services/checkout.service.js` into single-responsibility components:

- `paymentIntent.service.js`
  - create/resume intent
  - regenerate intent attempt
  - status resolution for FE
- `paymentAttempt.service.js`
  - provider attempt creation/update transitions
- `payos.provider.js` (adapter)
  - create payment link
  - verify webhook payload
- keep checkout finalization logic isolated from provider transport logic

## Repository Layer

Repositories remain data-access only (no business orchestration):

- New `paymentIntent.repo.js`
- Keep/adjust `paymentAttempt.repo.js`

Rules:

- Repositories do SQL only
- State transition decisions stay in service layer
- Transaction boundaries owned by orchestrator service

## API Contract

### Create/Resume Intent

- `POST /employee/parking/exit/:session_id/payment-intents`
- Request:
  - `idempotency_key` (required)
  - optional `payment_method`
- Behavior:
  - resume active intent if present
  - otherwise create new intent + active attempt
- Response:
  - `{ intent, active_attempt }`

### Regenerate

- `POST /employee/parking/exit/:session_id/payment-intents/regenerate`
- Request:
  - `idempotency_key` (required)
  - `force_new: true`
- Behavior:
  - supersede old active attempt
  - create new attempt under same active intent when valid
- Response:
  - `{ intent, active_attempt }`

### Status

- `GET /employee/parking/exit/:session_id/payment-status`
- Response:
  - `intent_status`
  - `active_checkout_url`
  - `expires_at`
  - `intent_id`, `attempt_id`

## Webhook Processing (Replay-safe)

Entry point: `be/controllers/webhook.payment.controller.js`.

Flow:

1. Verify signature
2. Map `orderCode` -> `payment_attempt`
3. Map attempt -> `payment_intent`
4. Mutate only if mapped attempt is current active attempt and intent is mutable (`PENDING`)
5. Finalize checkout once when transitioning to `PAID`
6. Duplicate webhook or unknown order returns 2xx replay-safe response with no incorrect mutation

## Frontend Behavior

Primary files:

- `fe/app/employee/checkout/[sessionid]/page.jsx`
- `fe/app/api/employee.client.js`

Required behavior:

1. On page load: call status first
2. If active intent exists, mount checkout immediately (resume)
3. Create only when no active intent
4. Regenerate only on explicit user action (`Generate New QR`)
5. Switching CARD/CASH must not create stray attempts and must preserve valid intent state

## Observability

Structured logs fields:

- `session_id`
- `intent_id`
- `attempt_id`
- `order_code`
- `webhook_event_id`

Metrics:

- `create_intent`
- `reuse_intent`
- `regenerate`
- `webhook_success`
- `webhook_replay`
- `finalize_latency`

## Testing Strategy

Unit:

- Intent and attempt state transition validation
- Transition guards (invalid state moves rejected)

Integration:

- Webhook idempotency/replay behavior
- Concurrent regenerate race test with transaction locks

E2E:

- Page refresh preserves same active intent
- Switching CASH/CARD does not create incorrect attempts
- Regenerate creates controlled new attempt and supersedes prior active attempt

## Rollout Plan

1. Feature flag new intent flow
2. Migration + backfill from existing attempts to intent model
3. Run old/new flow in parallel with comparison logs
4. Validate stability and metrics
5. Remove old flow paths after stabilization

## Definition of Done

- Refresh does not create new attempt if intent remains active.
- Every session has at most one active intent at all times.
- Webhook replay never creates duplicate settlement/finalization.
- CARD/CASH switching does not corrupt intent state.
- Logs and metrics allow incident tracing within minutes.
