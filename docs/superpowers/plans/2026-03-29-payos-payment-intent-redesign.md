# PayOS Payment Intent Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a Payment Intent-based checkout flow where each parking session has at most one active intent, with replay-safe webhook handling and inline-resumable frontend behavior.

**Architecture:** Introduce `payment_intents` as the business source of truth and keep `payment_attempts` as provider history. Split orchestration logic from provider adapter and enforce concurrency guarantees using transaction locks plus idempotency keys. Upgrade API contracts so frontend resumes active intent instead of always creating attempts, and keep webhook finalization idempotent.

**Tech Stack:** Node.js/Express, PostgreSQL, Next.js/React, Jest, Docker Compose, PayOS SDK.

---

## File Structure (Target)

- Create: `db/init/004_payment_intents.sql` - add `payment_intents`, FK/index updates, constraints.
- Create: `be/repositories/paymentIntent.repo.js` - pure data-access for intents.
- Modify: `be/repositories/paymentAttempt.repo.js` - attach `intent_id` and active-attempt query helpers.
- Create: `be/services/paymentIntent.service.js` - create/resume/regenerate/status orchestration.
- Create: `be/services/payos.provider.js` - provider adapter wrapper.
- Modify: `be/services/checkout.service.js` - keep legacy checkout concerns, remove payment orchestration.
- Modify: `be/controllers/employee.payment.controller.js` - new contract for create/resume/regenerate/status.
- Modify: `be/controllers/webhook.payment.controller.js` - replay-safe mutation behavior + structured logs.
- Modify: `be/routes/employee.routes.js` - add regenerate endpoint.
- Modify: `be/routes/payment.routes.js` - keep webhook route, ensure stable contract.
- Modify: `be/app.js` - inject feature-flag config into runtime if needed.
- Modify: `be/config/constants.js` - add payment-intent feature flag constants.
- Modify: `fe/app/api/employee.client.js` - create/resume/regenerate/status client calls.
- Modify: `fe/app/employee/checkout/[sessionid]/page.jsx` - status-first resume flow + Generate New QR.
- Create: `fe/app/components/payment/PayOSEmbed.jsx` - isolated embedded checkout lifecycle.
- Modify: `be/__tests__/services/checkout.service.test.js` - trim/realign legacy tests.
- Create: `be/__tests__/services/paymentIntent.service.test.js` - intent/attempt transition + idempotency tests.
- Modify: `be/__tests__/controllers/webhook.payment.controller.test.js` - replay-safe 2xx behavior.
- Create: `be/__tests__/integration/payment-intent-race.test.js` - concurrent regenerate lock behavior.

### Task 1: Database Migration and Active-Intent Invariant

**Files:**
- Create: `db/init/004_payment_intents.sql`
- Modify: `db/init/003_payment_attempts.sql`
- Test: run migration in local DB container

- [ ] **Step 1: Write the failing migration verification query**

```sql
SELECT intent_id, session_id, status
FROM payment_intents
LIMIT 1;
```

- [ ] **Step 2: Run query to verify it fails before migration**

Run: `docker compose exec postgres psql -U admin -d parking_lot -c "SELECT intent_id FROM payment_intents LIMIT 1;"`
Expected: FAIL with `relation "payment_intents" does not exist`

- [ ] **Step 3: Implement migration SQL**

```sql
CREATE TABLE IF NOT EXISTS payment_intents (
    intent_id BIGSERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES parkingsessions(session_id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'PAYOS',
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    status VARCHAR(40) NOT NULL CHECK (status IN ('REQUIRES_PAYMENT_METHOD','PENDING','PAID','CANCELED','EXPIRED')),
    active_attempt_id BIGINT NULL,
    idempotency_key VARCHAR(128) NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE payment_attempts
    ADD COLUMN IF NOT EXISTS intent_id BIGINT;

ALTER TABLE payment_attempts
    ADD CONSTRAINT fk_payment_attempts_intent
    FOREIGN KEY (intent_id) REFERENCES payment_intents(intent_id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_intent_per_session
    ON payment_intents(session_id)
    WHERE status IN ('REQUIRES_PAYMENT_METHOD','PENDING');

CREATE INDEX IF NOT EXISTS idx_payment_intents_session ON payment_intents(session_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_intent ON payment_attempts(intent_id);
```

- [ ] **Step 4: Run migration and verify pass**

Run: `docker compose up -d db-migrate && docker compose logs db-migrate --tail 100`
Expected: `All migrations applied successfully.`

- [ ] **Step 5: Verify active-intent unique partial index exists**

Run: `docker compose exec postgres psql -U admin -d parking_lot -c "\d payment_intents"`
Expected: index `uq_active_intent_per_session` is listed

- [ ] **Step 6: Commit**

```bash
git add db/init/003_payment_attempts.sql db/init/004_payment_intents.sql
git commit -m "feat(db): add payment_intents schema and active intent constraints"
```

### Task 2: Repository Normalization (Pure Data Access)

**Files:**
- Create: `be/repositories/paymentIntent.repo.js`
- Modify: `be/repositories/paymentAttempt.repo.js`
- Test: `be/__tests__/services/paymentIntent.service.test.js` (later task consumes these repos)

- [ ] **Step 1: Write failing unit test for intent repo contract**

```javascript
it("loads active intent by session and status", async () => {
  paymentIntentRepo.getActiveBySession.mockResolvedValue(null);
  const result = await paymentIntentRepo.getActiveBySession(4, mockClient);
  expect(result).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails because repo file missing**

Run: `cd be && npm test -- --runInBand __tests__/services/paymentIntent.service.test.js`
Expected: FAIL with module not found for `paymentIntent.repo`

- [ ] **Step 3: Implement `paymentIntent.repo.js` (data access only)**

```javascript
exports.getActiveBySessionForUpdate = async (sessionId, client) => {
  const result = await client.query(
    `SELECT * FROM payment_intents
     WHERE session_id = $1 AND status IN ('REQUIRES_PAYMENT_METHOD','PENDING')
     ORDER BY intent_id DESC LIMIT 1
     FOR UPDATE`,
    [sessionId]
  );
  return result.rows[0] || null;
};
```

- [ ] **Step 4: Modify `paymentAttempt.repo.js` to support intent relation only**

```javascript
exports.createAttempt = async ({ intentId, sessionId, provider, paymentMethod, amount }, client = pool) => {
  const result = await client.query(
    `INSERT INTO payment_attempts(intent_id, session_id, provider, payment_method, status, amount)
     VALUES ($1, $2, $3, $4, 'CREATED', $5)
     RETURNING *`,
    [intentId, sessionId, provider, paymentMethod, amount]
  );
  return result.rows[0];
};
```

- [ ] **Step 5: Run targeted tests**

Run: `cd be && npm test -- --runInBand __tests__/services/paymentIntent.service.test.js`
Expected: PASS for repository contract tests

- [ ] **Step 6: Commit**

```bash
git add be/repositories/paymentIntent.repo.js be/repositories/paymentAttempt.repo.js
git commit -m "refactor(repo): introduce payment intent repository and intent-linked attempts"
```

### Task 3: Intent Orchestration Service with Locking + Idempotency

**Files:**
- Create: `be/services/paymentIntent.service.js`
- Create: `be/services/payos.provider.js`
- Modify: `be/services/checkout.service.js`
- Test: `be/__tests__/services/paymentIntent.service.test.js`

- [ ] **Step 1: Write failing tests for state transitions and idempotency**

```javascript
it("reuses active intent for same session when not force_new", async () => {
  // active intent exists and should be returned without creating new intent
});

it("creates new attempt with fresh idempotency key on regenerate", async () => {
  // force_new true creates SUPERSEDED old active attempt + new active attempt
});
```

- [ ] **Step 2: Run tests to verify failures are expected**

Run: `cd be && npm test -- --runInBand __tests__/services/paymentIntent.service.test.js`
Expected: FAIL on missing service exports

- [ ] **Step 3: Implement minimal orchestration service**

```javascript
async function createOrResumeIntent({ sessionId, idempotencyKey, forceNew = false }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const activeIntent = await paymentIntentRepo.getActiveBySessionForUpdate(sessionId, client);
    if (activeIntent && !forceNew) {
      const activeAttempt = await paymentAttemptRepo.getActiveAttemptByIntentId(activeIntent.intent_id, client);
      await client.query("COMMIT");
      return { intent: activeIntent, activeAttempt, reused: true };
    }
    // create or regenerate path...
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 4: Keep provider calls isolated in adapter**

```javascript
exports.createPaymentLink = async (payload) => payosClient.createPaymentLink(payload);
exports.verifyWebhook = async (payload) => payosClient.verifyWebhook(payload);
```

- [ ] **Step 5: Run unit tests**

Run: `cd be && npm test -- --runInBand __tests__/services/paymentIntent.service.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add be/services/paymentIntent.service.js be/services/payos.provider.js be/services/checkout.service.js be/__tests__/services/paymentIntent.service.test.js
git commit -m "feat(service): add payment intent orchestration with lock and idempotency"
```

### Task 4: API Contract Upgrade (Create/Resume, Regenerate, Status)

**Files:**
- Modify: `be/controllers/employee.payment.controller.js`
- Modify: `be/routes/employee.routes.js`
- Modify: `be/config/constants.js`
- Test: controller tests

- [ ] **Step 1: Write failing controller tests for new contract**

```javascript
it("create intent returns intent and active_attempt", async () => {
  // expects data.intent and data.active_attempt shape
});

it("regenerate requires force_new true", async () => {
  // expects 422 when missing force_new
});
```

- [ ] **Step 2: Run tests and verify expected failures**

Run: `cd be && npm test -- --runInBand __tests__/controllers/employee.payment.controller.test.js`
Expected: FAIL due to old response shape

- [ ] **Step 3: Implement new controller methods**

```javascript
exports.createOrResumeIntent = async (req, res) => {
  const result = await paymentIntentService.createOrResumeIntent({
    sessionId: Number(req.params.session_id),
    idempotencyKey: req.body.idempotency_key,
    forceNew: false,
  });
  return res.status(200).json({ success: true, data: result });
};
```

- [ ] **Step 4: Add regenerate route**

Run implementation in `be/routes/employee.routes.js`:

```javascript
router.post("/parking/exit/:session_id/payment-intents/regenerate", employeePaymentController.regenerateIntent);
```

- [ ] **Step 5: Run controller tests**

Run: `cd be && npm test -- --runInBand __tests__/controllers/employee.payment.controller.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add be/controllers/employee.payment.controller.js be/routes/employee.routes.js be/config/constants.js be/__tests__/controllers/employee.payment.controller.test.js
git commit -m "feat(api): add create-resume-regenerate payment intent contract"
```

### Task 5: Replay-Safe Webhook Finalization

**Files:**
- Modify: `be/controllers/webhook.payment.controller.js`
- Modify: `be/services/paymentIntent.service.js`
- Modify: `be/services/checkout.service.js`
- Test: `be/__tests__/controllers/webhook.payment.controller.test.js`, integration webhook tests

- [ ] **Step 1: Write failing webhook replay/idempotency tests**

```javascript
it("returns 200 for duplicate webhook and does not mutate paid intent", async () => {
  // expect replay-safe response and no duplicate settlement
});

it("returns 200 for unknown orderCode", async () => {
  // expect ignored_unknown_order behavior
});
```

- [ ] **Step 2: Run tests to observe failures**

Run: `cd be && npm test -- --runInBand __tests__/controllers/webhook.payment.controller.test.js`
Expected: FAIL on 400-or-mutation behavior mismatch

- [ ] **Step 3: Implement replay-safe processing path**

```javascript
const result = await paymentIntentService.processWebhook(req.body);
return res.status(200).json({ success: true, data: result });
```

`processWebhook` must:
- verify signature
- resolve attempt/intent from `orderCode`
- mutate only active mutable intent/attempt
- return ignored replay result for duplicates/unknown

- [ ] **Step 4: Add structured logs for traceability**

```javascript
console.log(JSON.stringify({
  event: "payos_webhook_processed",
  session_id,
  intent_id,
  attempt_id,
  order_code,
  webhook_event_id,
  replay: true,
}));
```

- [ ] **Step 5: Run tests**

Run: `cd be && npm test -- --runInBand __tests__/controllers/webhook.payment.controller.test.js __tests__/integration/payment-intent-webhook.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add be/controllers/webhook.payment.controller.js be/services/paymentIntent.service.js be/services/checkout.service.js be/__tests__/controllers/webhook.payment.controller.test.js be/__tests__/integration/payment-intent-webhook.test.js
git commit -m "fix(webhook): make payment finalization replay-safe with active attempt checks"
```

### Task 6: Frontend Resume-First and Inline Embedded Checkout

**Files:**
- Create: `fe/app/components/payment/PayOSEmbed.jsx`
- Modify: `fe/app/api/employee.client.js`
- Modify: `fe/app/employee/checkout/[sessionid]/page.jsx`
- Test: frontend component/page tests (or integration smoke)

- [ ] **Step 1: Write failing frontend tests for resume-first behavior**

```javascript
it("loads active intent from status and mounts inline embed without create", async () => {
  // status returns active intent and embed should mount immediately
});

it("generate new QR calls regenerate endpoint with new idempotency key", async () => {
  // explicit click only
});
```

- [ ] **Step 2: Run tests to verify failures**

Run: `cd fe && npm test -- payment-checkout` (or configured test command)
Expected: FAIL due to old always-create behavior

- [ ] **Step 3: Implement `PayOSEmbed.jsx` component**

```jsx
useEffect(() => {
  if (!checkoutUrl) return;
  // load script once, init embedded checkout with ELEMENT_ID and CHECKOUT_URL
}, [checkoutUrl, elementId]);
```

- [ ] **Step 4: Update API client contract**

```javascript
export async function createOrResumePaymentIntent(sessionId, idempotencyKey) { ... }
export async function regeneratePaymentIntent(sessionId, idempotencyKey) { ... }
export async function fetchPaymentStatus(sessionId) { ... }
```

- [ ] **Step 5: Update checkout page flow**

- load status first
- resume if active exists
- create only if none exists
- regenerate only on explicit button click
- keep polling intent status; redirect on `PAID`

- [ ] **Step 6: Run frontend tests/lint/build check**

Run: `cd fe && npm run lint && npm run build`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add fe/app/components/payment/PayOSEmbed.jsx fe/app/api/employee.client.js fe/app/employee/checkout/[sessionid]/page.jsx
git commit -m "feat(frontend): resume active payment intent and embed PayOS checkout inline"
```

### Task 7: Observability and Metrics

**Files:**
- Modify: `be/controllers/webhook.payment.controller.js`
- Modify: `be/services/paymentIntent.service.js`
- Modify: logging/metrics utility file(s) used in backend
- Test: log-shape unit tests (if present) + manual verification

- [ ] **Step 1: Write failing tests/assertions for required log fields**

```javascript
expect(logPayload).toEqual(expect.objectContaining({
  session_id: expect.any(Number),
  intent_id: expect.any(Number),
  attempt_id: expect.any(Number),
  order_code: expect.any(String),
}));
```

- [ ] **Step 2: Implement metrics emission points**

- create/resume/regenerate endpoint service exits
- webhook success/replay exits
- checkout finalize completion with latency

- [ ] **Step 3: Run backend tests**

Run: `cd be && npm test -- --runInBand`
Expected: PASS

- [ ] **Step 4: Manual smoke log verification**

Run: `docker compose logs backend --tail 200`
Expected: structured logs include required keys

- [ ] **Step 5: Commit**

```bash
git add be/controllers/webhook.payment.controller.js be/services/paymentIntent.service.js
git commit -m "chore(obs): add structured payment intent logs and core metrics"
```

### Task 8: Feature Flag, Backfill, and Safe Rollout

**Files:**
- Create: `db/init/005_payment_intents_backfill.sql`
- Modify: `be/config/constants.js`
- Modify: `docker-compose.yml` and `.env.example`
- Modify: docs (`README.md` or ops doc)
- Test: migration + dual-path behavior

- [ ] **Step 1: Write failing rollout validation query**

```sql
SELECT session_id
FROM payment_intents
GROUP BY session_id
HAVING COUNT(*) FILTER (WHERE status IN ('REQUIRES_PAYMENT_METHOD','PENDING')) > 1;
```

- [ ] **Step 2: Implement backfill migration**

- map historical attempts to intents
- set `intent_id` on attempts
- derive active intent where applicable

- [ ] **Step 3: Add feature flag wiring**

```javascript
const PAYMENT_INTENT_V2_ENABLED = process.env.PAYMENT_INTENT_V2_ENABLED === "true";
```

- [ ] **Step 4: Run migration and verification queries**

Run:
- `docker compose up -d db-migrate`
- `docker compose exec postgres psql -U admin -d parking_lot -c "<validation query>"`

Expected: zero rows violating active-intent invariant

- [ ] **Step 5: Update docs for rollout toggles and monitoring**

Include:
- env flag usage
- comparison log checklist
- rollback steps

- [ ] **Step 6: Commit**

```bash
git add db/init/005_payment_intents_backfill.sql be/config/constants.js docker-compose.yml .env.example README.md
git commit -m "chore(rollout): add payment intent v2 flag and backfill migration"
```

## Spec Coverage Self-Review

- Payment intent as primary entity: covered by Tasks 1-3.
- Attempt as history and state machine: covered by Tasks 1-3.
- Schema/index/race-condition/idempotency: covered by Tasks 1-3 and 8.
- SRP refactor and repo normalization: covered by Tasks 2-3.
- API contract upgrades: covered by Task 4.
- Replay-safe webhook behavior: covered by Task 5.
- Frontend resume-first and regenerate UX: covered by Task 6.
- Observability and metrics: covered by Task 7.
- Safe rollout with feature flag/backfill: covered by Task 8.

No spec gaps identified.
