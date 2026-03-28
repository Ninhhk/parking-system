# Payment Checkout Design (PayOS + Webhook-First Finalization)

Date: 2026-03-28

## 1) Goal and Scope

Implement payment on employee checkout screen `http://localhost:3000/employee/checkout/:sessionid` with these rules:

- Default payment method on UI is `CARD`.
- `CARD` checkout is asynchronous and must be finalized only when PayOS webhook confirms success.
- `CASH` remains synchronous and can proceed as current behavior.
- A parking session is considered checked out only when `parkingsessions.time_out` is set.

This design adopts **Approach B**:

- `payment_attempts` stores payment lifecycle attempts.
- Existing `payment` table is a settled ledger only.

## 2) Current State Summary

Relevant current behavior:

- Backend checkout preview endpoint: `GET /api/employee/parking/exit/:session_id` (`be/controllers/employee.sessions.controller.js`).
- Backend direct confirm endpoint: `POST /api/employee/parking/exit/confirm` creates payment + closes session in one flow (`be/repositories/employee.sessions.repo.js#createAndConfirmPayment`).
- Frontend checkout detail page at `fe/app/employee/checkout/[sessionid]/page.jsx` with `CASH` and `CARD` radio options and direct confirm button.
- Existing DB table `payment` in `db/init/001_schema.sql` currently used for all payment writes.

Problem with current `CARD` flow: it allows direct finalize without webhook-confirmed settlement.

## 3) Domain Model and Invariants

### 3.1 Parking Session (source of checkout truth)

- Checkout success is defined by `parkingsessions.time_out IS NOT NULL`.
- Any payment status change without `time_out` is not completed vehicle exit.

### 3.2 Payment Attempt (new table)

Purpose:

- Track payment lifecycle per QR creation attempt (`PENDING`, `PAID`, `FAILED`, `EXPIRED`).
- Store provider metadata and webhook payload for audit/debug.

Each QR generation creates one attempt row.

### 3.3 Payment Ledger (`payment` existing table)

Purpose:

- Store only settled payments for reporting/revenue.

Rule:

- Insert into `payment` only after successful settlement and checkout finalization.

## 4) Database Design Changes

### 4.1 New table: `payment_attempts`

Proposed schema:

```sql
CREATE TABLE IF NOT EXISTS payment_attempts (
    attempt_id BIGSERIAL PRIMARY KEY,
    session_id INT NOT NULL,
    sub_id INT,
    provider VARCHAR(50) NOT NULL DEFAULT 'PAYOS',
    payment_method VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    provider_order_code VARCHAR(100),
    provider_transaction_id VARCHAR(100),
    qr_code_url TEXT,
    checkout_url TEXT,
    expires_at TIMESTAMP,
    webhook_payload JSONB,
    failure_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_payment_attempts_session
        FOREIGN KEY (session_id) REFERENCES parkingsessions(session_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_payment_attempts_sub
        FOREIGN KEY (sub_id) REFERENCES monthlysubs(sub_id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_payment_attempts_status
        CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED'))
);
```

### 4.2 Constraints and indexes

```sql
-- Webhook idempotency key
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_provider_order_code
    ON payment_attempts(provider_order_code)
    WHERE provider_order_code IS NOT NULL;

-- Fast latest attempt/status lookups
CREATE INDEX IF NOT EXISTS idx_payment_attempts_session_status_created
    ON payment_attempts(session_id, status, created_at DESC);

-- One settled ledger row per parking session
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_session_id
    ON payment(session_id)
    WHERE session_id IS NOT NULL;

-- Prevent duplicate active session per license plate
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_plate
    ON parkingsessions(license_plate)
    WHERE time_out IS NULL;
```

### 4.3 Finalization safety rule

Any session close update must use:

```sql
UPDATE parkingsessions
SET time_out = NOW(), parking_fee = $amount
WHERE session_id = $sessionId AND time_out IS NULL
RETURNING *;
```

If `RETURNING` yields no row, treat as already finalized idempotently.

## 5) Backend Architecture

### 5.1 Repository split

Create/reshape repositories:

- `session.repo`
  - `getSessionForCheckout(sessionId)`
  - `finalizeSessionIfOpen({ sessionId, totalAmount, isLost })`
  - `decrementLotCountAtomic({ lotId, vehicleType })`
- `paymentAttempt.repo`
  - `createAttempt({...})`
  - `attachProviderIntent({ attemptId, providerOrderCode, qrCodeUrl, checkoutUrl, expiresAt })`
  - `getLatestBySession(sessionId)`
  - `markPaidByOrderCode({ providerOrderCode, providerTransactionId, webhookPayload })`
  - `markFailedOrExpired({...})`
- `paymentLedger.repo`
  - `insertSettledPayment({ sessionId, subId, paymentMethod, totalAmount, paymentDate })`

### 5.2 Checkout service (orchestrator)

Create `checkout.service` with core methods:

- `previewFee(sessionId)`
  - Read-only fee calculation, no writes.
- `createIntent({ sessionId, paymentMethod })`
  - Validate session open (`time_out IS NULL`).
  - Create attempt as `PENDING`.
  - Call PayOS to create order/QR.
  - Persist provider fields in attempt and return QR payload.
- `confirmCashCheckout({ sessionId })`
  - Existing synchronous cash flow, but finalization is idempotent with `time_out IS NULL`.
  - Write settled ledger row.
- `finalizeFromWebhook({ payload, signature })`
  - Verify PayOS signature.
  - Resolve attempt by `provider_order_code`.
  - Idempotently mark attempt `PAID`.
  - Finalize session iff still open.
  - Insert settled ledger row iff not already inserted.
  - All state-changing DB operations in a single transaction.

### 5.3 Thin controllers

- Keep `employee.sessions.controller` focused on validation and response formatting.
- Add payment controller for intent/status endpoints.
- Add webhook controller with public route (no employee auth) but strict signature verification.

## 6) API Contract

### 6.1 Employee-facing

- `GET /api/employee/parking/exit/:session_id`
  - Returns fee preview and session details (existing behavior).

- `POST /api/employee/parking/exit/:session_id/payment-intents`
  - Body: `{ "payment_method": "CARD" }`
  - Returns:
    - `attempt_id`
    - `provider_order_code`
    - `qr_code_url`
    - `checkout_url`
    - `expires_at`
    - `status` (`PENDING`)

- `GET /api/employee/parking/exit/:session_id/payment-status`
  - Returns latest attempt status and relevant metadata.

- `POST /api/employee/parking/exit/confirm`
  - For `CASH` only in Sprint 1.
  - For `CARD`, reject direct manual finalize.

### 6.2 Provider-facing

- `POST /api/payments/payos/webhook`
  - Public endpoint.
  - Verify PayOS signature.
  - Idempotently process event and return `200` for valid processed/replayed events.

## 7) Frontend UX/Flow (`/employee/checkout/[sessionid]`)

### 7.1 Default behavior

- Default selected payment method: `CARD`.

### 7.2 CARD flow

- Employee selects `CARD` (default).
- UI calls create-intent endpoint and shows QR panel.
- UI polls `payment-status` periodically.
- “Confirm Payment” manual button is disabled/hidden for `CARD`.
- Redirect to success page only when status turns `PAID` (which implies webhook finalized checkout and set `time_out`).

### 7.3 CASH flow

- Employee selects `CASH`.
- Existing confirm flow proceeds synchronously.
- Success page behavior unchanged.

## 8) Idempotency and Concurrency Design

### 8.1 Webhook idempotency

- Unique `provider_order_code` ensures one logical attempt identity.
- Replayed webhook events should not duplicate finalize/ledger writes.

### 8.2 Checkout finalization idempotency

- Session close is conditional (`time_out IS NULL`).
- If already closed, service returns safe success semantics.
- Ledger insert protected by unique `payment.session_id`.

### 8.3 Entry/session consistency

- Enforce unique active session by plate via partial unique index.
- Use atomic lot count update in DB transaction.

## 9) Migration and Delivery Plan

### Sprint 1

- Add `payment_attempts` table and indexes/constraints.
- Add create-intent endpoint and webhook endpoint.
- Implement CARD asynchronous flow in UI and backend.
- Keep CASH current flow.

### Sprint 2

- Route CASH through attempt model too (`provider='OFFLINE'`) for unified lifecycle.
- Keep final settled writes in `payment`.

### Sprint 3

- Remove/deprecate direct CARD confirm path.
- Clean old code paths.
- Standardize reporting to read only settled `payment` rows.

## 10) Operational and Scale Readiness

- Move session store from in-memory to Redis for multi-instance support.
- Tune Postgres pool config (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`) per instance count.
- Add structured logs for payment attempt lifecycle and webhook processing.
- Capture webhook processing metrics (success, replay, signature-fail, finalize-latency).

## 11) Testing Strategy

### Unit tests

- `checkout.service`:
  - create intent success/failure.
  - webhook success, webhook replay, invalid signature.
  - finalize idempotency when `time_out` already set.

### Integration tests

- Full CARD flow:
  - preview -> intent -> webhook -> session closed -> ledger inserted once.
- CASH flow:
  - direct confirm closes session and inserts ledger once.
- Duplicate webhook delivery does not duplicate settlement.

### Concurrency/load tests

- Concurrent intent creation for same session.
- Concurrent webhook retries for same order code.
- High-throughput entry/checkout with active-session uniqueness constraints.

## 12) Non-goals (this phase)

- No provider abstraction for multiple online gateways beyond PayOS in Sprint 1.
- No redesign of admin reporting UI beyond ensuring it reads settled ledger.

## 13) Acceptance Criteria

- CARD checkout cannot be marked successful unless webhook path has finalized session (`time_out` set).
- Replayed webhook is safe and does not duplicate ledger writes.
- CASH flow remains functional.
- Frontend checkout screen defaults to CARD and displays QR-based status progression.
- `payment` table contains only settled payments after implementation.
