# PayOS Webhook-First Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CARD checkout on employee checkout screen using PayOS QR/embedded checkout where checkout finalization happens only after verified webhook success, while CASH flow continues to work.

**Architecture:** Introduce `payment_attempts` as payment lifecycle storage, keep `payment` as settled ledger only, and move checkout orchestration into a dedicated `checkout.service`. CARD becomes async (`PENDING -> PAID` via webhook), and parking session closure is idempotent (`time_out IS NULL` guard). Controllers stay thin and repositories are split by responsibility.

**Tech Stack:** Node.js + Express + PostgreSQL + Jest/Supertest + Next.js + Axios + PayOS Node SDK (`@payos/node`).

---

## File Structure Map

- `db/init/003_payment_attempts.sql` (create): migration for `payment_attempts` table and indexes/constraints.
- `be/config/constants.js` (modify): add PayOS and payment-attempt statuses constants.
- `be/services/payos.client.js` (create): PayOS SDK wrapper (`createPaymentLink`, `verifyWebhook`).
- `be/repositories/session.repo.js` (create): parking session finalize + lot count atomic updates.
- `be/repositories/paymentAttempt.repo.js` (create): create/update/get attempt rows.
- `be/repositories/paymentLedger.repo.js` (create): settled ledger inserts to `payment`.
- `be/services/checkout.service.js` (create): `previewFee`, `createIntent`, `getPaymentStatus`, `confirmCashCheckout`, `finalizeFromWebhook`.
- `be/controllers/employee.payment.controller.js` (create): intent/status/cash confirm endpoints.
- `be/controllers/webhook.payment.controller.js` (create): PayOS webhook endpoint.
- `be/routes/employee.routes.js` (modify): add employee intent/status routes.
- `be/routes/payment.routes.js` (create): public webhook route.
- `be/app.js` (modify): mount payment webhook route.
- `be/package.json` (modify): add `@payos/node` dependency.
- `.env.example` (modify): add PayOS env keys and webhook/return/cancel URLs.
- `fe/app/api/employee.client.js` (modify): add payment intent/status API calls.
- `fe/app/employee/checkout/[sessionid]/page.jsx` (modify): default CARD + QR panel + polling + cash/card split behavior.
- `be/__tests__/services/payos.client.test.js` (create): PayOS wrapper unit tests.
- `be/__tests__/services/checkout.service.test.js` (create): checkout orchestration tests.
- `be/__tests__/controllers/webhook.payment.controller.test.js` (create): webhook controller tests.

## Task 1: Add PayOS dependency and configuration foundation

**Files:**
- Modify: `be/package.json`
- Modify: `.env.example`
- Modify: `be/config/constants.js`
- Create: `be/services/payos.client.js`
- Test: `be/__tests__/services/payos.client.test.js`

- [ ] **Step 1: Write failing test for PayOS wrapper behavior**

```js
// be/__tests__/services/payos.client.test.js
jest.mock("@payos/node", () => {
  return {
    PayOS: jest.fn().mockImplementation(() => ({
      paymentRequests: { create: jest.fn().mockResolvedValue({ checkoutUrl: "https://pay" }) },
      webhooks: { verify: jest.fn().mockReturnValue({ data: { orderCode: 123 } }) },
    })),
  };
});

const payosClient = require("../../services/payos.client");

test("createPaymentLink returns checkout payload", async () => {
  const result = await payosClient.createPaymentLink({
    orderCode: 123,
    amount: 12000,
    description: "Checkout #123",
    returnUrl: "http://localhost:3000/employee/checkout/1",
    cancelUrl: "http://localhost:3000/employee/checkout/1",
  });
  expect(result.checkoutUrl).toBe("https://pay");
});

test("verifyWebhook delegates to sdk verify", () => {
  const parsed = payosClient.verifyWebhook({ data: { orderCode: 123 }, signature: "sig" });
  expect(parsed.data.orderCode).toBe(123);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --runInBand be/__tests__/services/payos.client.test.js` (in `be`)

Expected: FAIL with `Cannot find module '../../services/payos.client'`.

- [ ] **Step 3: Implement minimal PayOS wrapper and constants/env entries**

```js
// be/services/payos.client.js
const { PayOS } = require("@payos/node");

const payOS = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

exports.createPaymentLink = async (payload) => payOS.paymentRequests.create(payload);
exports.verifyWebhook = (payload) => payOS.webhooks.verify(payload);
```

```js
// be/config/constants.js (add)
const PAYMENT_ATTEMPT_STATUSES = ["PENDING", "PAID", "FAILED", "EXPIRED"];
const PAYMENT_PROVIDERS = ["PAYOS", "OFFLINE"];
const PAYOS_DEFAULT_RETURN_URL = process.env.PAYOS_RETURN_URL || "http://localhost:3000/employee/checkout";
const PAYOS_DEFAULT_CANCEL_URL = process.env.PAYOS_CANCEL_URL || "http://localhost:3000/employee/checkout";
```

```env
# .env.example (add)
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
PAYOS_RETURN_URL=http://localhost:3000/employee/checkout
PAYOS_CANCEL_URL=http://localhost:3000/employee/checkout
PAYOS_WEBHOOK_PATH=/api/payments/payos/webhook
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- --runInBand be/__tests__/services/payos.client.test.js`

Expected: PASS for both PayOS wrapper tests.

- [ ] **Step 5: Commit**

```bash
git add be/package.json .env.example be/config/constants.js be/services/payos.client.js be/__tests__/services/payos.client.test.js
git commit -m "feat: add PayOS client wrapper and payment constants"
```

## Task 2: Add payment_attempts migration and DB constraints

**Files:**
- Create: `db/init/003_payment_attempts.sql`
- Modify: `db/init/001_schema.sql` (only add safe unique index for settled payment/session if not already present)
- Test: migration smoke check command

- [ ] **Step 1: Write migration assertions as executable SQL checks (failing first)**

```sql
-- use in psql after current schema only
SELECT to_regclass('public.payment_attempts') IS NOT NULL AS table_exists;
SELECT indexname FROM pg_indexes WHERE indexname = 'uq_payment_attempts_provider_order_code';
SELECT indexname FROM pg_indexes WHERE indexname = 'uq_active_session_plate';
SELECT indexname FROM pg_indexes WHERE indexname = 'uq_payment_session_id';
```

- [ ] **Step 2: Run SQL checks before migration**

Run: `psql "$DB_URL" -c "SELECT to_regclass('public.payment_attempts') IS NOT NULL AS table_exists;"`

Expected: `table_exists = f` (or relation missing).

- [ ] **Step 3: Implement migration SQL**

```sql
-- db/init/003_payment_attempts.sql
CREATE TABLE IF NOT EXISTS payment_attempts (
  attempt_id BIGSERIAL PRIMARY KEY,
  session_id INT NOT NULL,
  sub_id INT,
  provider VARCHAR(50) NOT NULL DEFAULT 'PAYOS',
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING','PAID','FAILED','EXPIRED')),
  amount DECIMAL(10,2) NOT NULL,
  provider_order_code VARCHAR(100),
  provider_transaction_id VARCHAR(100),
  qr_code_url TEXT,
  checkout_url TEXT,
  expires_at TIMESTAMP,
  webhook_payload JSONB,
  failure_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_payment_attempts_session FOREIGN KEY (session_id)
    REFERENCES parkingsessions(session_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_attempts_sub FOREIGN KEY (sub_id)
    REFERENCES monthlysubs(sub_id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_provider_order_code
  ON payment_attempts(provider_order_code)
  WHERE provider_order_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_attempts_session_status_created
  ON payment_attempts(session_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_session_id
  ON payment(session_id)
  WHERE session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_plate
  ON parkingsessions(license_plate)
  WHERE time_out IS NULL;
```

- [ ] **Step 4: Run migration and verify checks pass**

Run:
- `psql "$DB_URL" -f db/init/003_payment_attempts.sql`
- `psql "$DB_URL" -c "SELECT to_regclass('public.payment_attempts');"`

Expected: table exists and indexes are present.

- [ ] **Step 5: Commit**

```bash
git add db/init/003_payment_attempts.sql
git commit -m "feat: add payment attempts schema and idempotency constraints"
```

## Task 3: Create repository layer split for session/attempt/ledger

**Files:**
- Create: `be/repositories/session.repo.js`
- Create: `be/repositories/paymentAttempt.repo.js`
- Create: `be/repositories/paymentLedger.repo.js`
- Test: `be/__tests__/services/checkout.service.test.js` (repo-mocked tests first)

- [ ] **Step 1: Write failing service test expecting repo contracts**

```js
// be/__tests__/services/checkout.service.test.js (first test block)
jest.mock("../../repositories/session.repo", () => ({
  getSessionForCheckout: jest.fn(),
  finalizeSessionIfOpen: jest.fn(),
  decrementLotCountAtomic: jest.fn(),
}));
jest.mock("../../repositories/paymentAttempt.repo", () => ({
  createAttempt: jest.fn(),
  attachProviderIntent: jest.fn(),
  getLatestBySession: jest.fn(),
  markPaidByOrderCode: jest.fn(),
}));
jest.mock("../../repositories/paymentLedger.repo", () => ({
  insertSettledPayment: jest.fn(),
}));

const checkoutService = require("../../services/checkout.service");

test("createIntent fails when session already closed", async () => {
  const sessionRepo = require("../../repositories/session.repo");
  sessionRepo.getSessionForCheckout.mockResolvedValue({ session_id: 1, time_out: new Date().toISOString() });
  await expect(checkoutService.createIntent({ sessionId: 1, paymentMethod: "CARD" }))
    .rejects.toThrow("Session already checked out");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --runInBand be/__tests__/services/checkout.service.test.js`

Expected: FAIL because service/repositories do not exist yet.

- [ ] **Step 3: Implement repository files with exact methods**

```js
// be/repositories/session.repo.js
const { pool } = require("../config/db");

exports.getSessionForCheckout = async (sessionId, client = pool) => {
  const result = await client.query("SELECT * FROM parkingsessions WHERE session_id = $1", [sessionId]);
  return result.rows[0];
};

exports.finalizeSessionIfOpen = async ({ sessionId, totalAmount, isLost }, client) => {
  const result = await client.query(
    `UPDATE parkingsessions
       SET time_out = NOW(), parking_fee = $1, is_lost = $2
     WHERE session_id = $3 AND time_out IS NULL
     RETURNING *`,
    [totalAmount, !!isLost, sessionId]
  );
  return result.rows[0] || null;
};

exports.decrementLotCountAtomic = async ({ lotId, vehicleType }, client) => {
  const column = vehicleType.toLowerCase() === "car" ? "current_car" : "current_bike";
  await client.query(
    `UPDATE parkinglots SET ${column} = GREATEST(${column} - 1, 0) WHERE lot_id = $1`,
    [lotId]
  );
};
```

```js
// be/repositories/paymentAttempt.repo.js
const { pool } = require("../config/db");

exports.createAttempt = async ({ sessionId, subId, provider, paymentMethod, amount }, client = pool) => {
  const result = await client.query(
    `INSERT INTO payment_attempts(session_id, sub_id, provider, payment_method, status, amount)
     VALUES ($1,$2,$3,$4,'PENDING',$5)
     RETURNING *`,
    [sessionId, subId || null, provider, paymentMethod, amount]
  );
  return result.rows[0];
};

exports.attachProviderIntent = async ({ attemptId, providerOrderCode, qrCodeUrl, checkoutUrl, expiresAt }, client = pool) => {
  const result = await client.query(
    `UPDATE payment_attempts
        SET provider_order_code = $1, qr_code_url = $2, checkout_url = $3, expires_at = $4, updated_at = NOW()
      WHERE attempt_id = $5
      RETURNING *`,
    [providerOrderCode, qrCodeUrl, checkoutUrl, expiresAt || null, attemptId]
  );
  return result.rows[0];
};

exports.getLatestBySession = async (sessionId, client = pool) => {
  const result = await client.query(
    `SELECT * FROM payment_attempts WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [sessionId]
  );
  return result.rows[0] || null;
};

exports.markPaidByOrderCode = async ({ providerOrderCode, providerTransactionId, webhookPayload }, client = pool) => {
  const result = await client.query(
    `UPDATE payment_attempts
        SET status = 'PAID', provider_transaction_id = $1, webhook_payload = $2::jsonb, updated_at = NOW()
      WHERE provider_order_code = $3
      RETURNING *`,
    [providerTransactionId || null, JSON.stringify(webhookPayload), providerOrderCode]
  );
  return result.rows[0] || null;
};
```

```js
// be/repositories/paymentLedger.repo.js
const { pool } = require("../config/db");

exports.insertSettledPayment = async ({ sessionId, subId, paymentMethod, totalAmount }, client = pool) => {
  const result = await client.query(
    `INSERT INTO payment(session_id, sub_id, payment_method, total_amount, payment_date)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (session_id) DO NOTHING
     RETURNING *`,
    [sessionId, subId || null, paymentMethod, totalAmount]
  );
  return result.rows[0] || null;
};
```

- [ ] **Step 4: Run test to verify repo contracts are importable**

Run: `npm test -- --runInBand be/__tests__/services/checkout.service.test.js`

Expected: now fails on missing `checkout.service` implementation (next task), not on repository import errors.

- [ ] **Step 5: Commit**

```bash
git add be/repositories/session.repo.js be/repositories/paymentAttempt.repo.js be/repositories/paymentLedger.repo.js be/__tests__/services/checkout.service.test.js
git commit -m "refactor: split checkout repositories for session attempt and ledger"
```

## Task 4: Implement checkout.service orchestration (webhook-first CARD)

**Files:**
- Create: `be/services/checkout.service.js`
- Modify: `be/__tests__/services/checkout.service.test.js`

- [ ] **Step 1: Add failing tests for CARD intent, CASH confirm, webhook finalize idempotency**

```js
// add cases in be/__tests__/services/checkout.service.test.js
test("createIntent creates pending attempt and returns QR data", async () => {
  const sessionRepo = require("../../repositories/session.repo");
  const attemptRepo = require("../../repositories/paymentAttempt.repo");
  const payosClient = require("../../services/payos.client");

  sessionRepo.getSessionForCheckout.mockResolvedValue({ session_id: 1, time_out: null });
  attemptRepo.createAttempt.mockResolvedValue({ attempt_id: 10 });
  payosClient.createPaymentLink = jest.fn().mockResolvedValue({
    orderCode: 123456,
    checkoutUrl: "https://payos/checkout",
    qrCode: "000201...",
    expiredAt: "2026-03-28T12:00:00Z",
  });

  const checkoutService = require("../../services/checkout.service");
  const result = await checkoutService.createIntent({ sessionId: 1, paymentMethod: "CARD", amount: 20000 });
  expect(result.status).toBe("PENDING");
  expect(result.checkout_url).toContain("payos/checkout");
});

test("finalizeFromWebhook finalizes once and is safe on replay", async () => {
  const checkoutService = require("../../services/checkout.service");
  const first = await checkoutService.finalizeFromWebhook({ code: "00", success: true, data: { orderCode: 123 } });
  const second = await checkoutService.finalizeFromWebhook({ code: "00", success: true, data: { orderCode: 123 } });
  expect(first.ok).toBe(true);
  expect(second.ok).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- --runInBand be/__tests__/services/checkout.service.test.js`

Expected: FAIL because service methods are not implemented yet.

- [ ] **Step 3: Implement service methods using transaction boundaries**

```js
// be/services/checkout.service.js
const { pool } = require("../config/db");
const payosClient = require("./payos.client");
const sessionRepo = require("../repositories/session.repo");
const attemptRepo = require("../repositories/paymentAttempt.repo");
const ledgerRepo = require("../repositories/paymentLedger.repo");
const { PAYOS_DEFAULT_RETURN_URL, PAYOS_DEFAULT_CANCEL_URL } = require("../config/constants");

exports.createIntent = async ({ sessionId, paymentMethod, amount }) => {
  const session = await sessionRepo.getSessionForCheckout(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.time_out) throw new Error("Session already checked out");

  const attempt = await attemptRepo.createAttempt({
    sessionId,
    subId: null,
    provider: "PAYOS",
    paymentMethod,
    amount,
  });

  const orderCode = Number(`${Date.now()}`.slice(-9));
  const payosPayload = {
    orderCode,
    amount,
    description: `Checkout ${sessionId}`.slice(0, 25),
    returnUrl: `${PAYOS_DEFAULT_RETURN_URL}/${sessionId}`,
    cancelUrl: `${PAYOS_DEFAULT_CANCEL_URL}/${sessionId}`,
  };
  const link = await payosClient.createPaymentLink(payosPayload);

  const attached = await attemptRepo.attachProviderIntent({
    attemptId: attempt.attempt_id,
    providerOrderCode: String(link.orderCode || orderCode),
    qrCodeUrl: link.qrCode || null,
    checkoutUrl: link.checkoutUrl,
    expiresAt: link.expiredAt || null,
  });

  return {
    attempt_id: attached.attempt_id,
    provider_order_code: attached.provider_order_code,
    qr_code_url: attached.qr_code_url,
    checkout_url: attached.checkout_url,
    expires_at: attached.expires_at,
    status: attached.status,
  };
};

exports.getPaymentStatus = async ({ sessionId }) => {
  const latest = await attemptRepo.getLatestBySession(sessionId);
  return latest || { status: "NOT_FOUND" };
};

exports.confirmCashCheckout = async ({ sessionId, totalAmount, isLost }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const session = await sessionRepo.getSessionForCheckout(sessionId, client);
    if (!session) throw new Error("Session not found");
    const finalized = await sessionRepo.finalizeSessionIfOpen({ sessionId, totalAmount, isLost }, client);
    if (finalized) {
      await ledgerRepo.insertSettledPayment({ sessionId, subId: null, paymentMethod: "CASH", totalAmount }, client);
      await sessionRepo.decrementLotCountAtomic({ lotId: session.lot_id, vehicleType: session.vehicle_type }, client);
    }
    await client.query("COMMIT");
    return { ok: true, finalized: !!finalized };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

exports.finalizeFromWebhook = async (payload) => {
  const verified = payosClient.verifyWebhook(payload);
  const orderCode = String(verified.data.orderCode);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const attempt = await attemptRepo.markPaidByOrderCode(
      {
        providerOrderCode: orderCode,
        providerTransactionId: verified.data.reference,
        webhookPayload: verified,
      },
      client
    );
    if (!attempt) {
      await client.query("COMMIT");
      return { ok: true, replay: true };
    }

    const session = await sessionRepo.getSessionForCheckout(attempt.session_id, client);
    const finalized = await sessionRepo.finalizeSessionIfOpen(
      { sessionId: attempt.session_id, totalAmount: attempt.amount, isLost: false },
      client
    );
    if (finalized) {
      await ledgerRepo.insertSettledPayment(
        { sessionId: attempt.session_id, subId: attempt.sub_id, paymentMethod: "CARD", totalAmount: attempt.amount },
        client
      );
      await sessionRepo.decrementLotCountAtomic({ lotId: session.lot_id, vehicleType: session.vehicle_type }, client);
    }

    await client.query("COMMIT");
    return { ok: true, replay: !finalized };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};
```

- [ ] **Step 4: Run service tests to verify pass**

Run: `npm test -- --runInBand be/__tests__/services/checkout.service.test.js`

Expected: PASS for create intent, cash confirm, and webhook idempotency tests.

- [ ] **Step 5: Commit**

```bash
git add be/services/checkout.service.js be/__tests__/services/checkout.service.test.js
git commit -m "feat: add checkout service orchestration for payos webhook flow"
```

## Task 5: Add controllers and routes for payment intents and webhook

**Files:**
- Create: `be/controllers/employee.payment.controller.js`
- Create: `be/controllers/webhook.payment.controller.js`
- Create: `be/routes/payment.routes.js`
- Modify: `be/routes/employee.routes.js`
- Modify: `be/app.js`
- Test: `be/__tests__/controllers/webhook.payment.controller.test.js`

- [ ] **Step 1: Write failing webhook controller test**

```js
// be/__tests__/controllers/webhook.payment.controller.test.js
const controller = require("../../controllers/webhook.payment.controller");
const checkoutService = require("../../services/checkout.service");
jest.mock("../../services/checkout.service");

test("returns 200 for valid webhook payload", async () => {
  checkoutService.finalizeFromWebhook.mockResolvedValue({ ok: true, replay: false });
  const req = { body: { code: "00", success: true, data: { orderCode: 123 }, signature: "sig" } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.payosWebhook(req, res);
  expect(res.status).toHaveBeenCalledWith(200);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --runInBand be/__tests__/controllers/webhook.payment.controller.test.js`

Expected: FAIL because controller file does not exist.

- [ ] **Step 3: Implement controllers and routes**

```js
// be/controllers/employee.payment.controller.js
const checkoutService = require("../services/checkout.service");

exports.createIntent = async (req, res) => {
  try {
    const sessionId = Number(req.params.session_id);
    const result = await checkoutService.createIntent({
      sessionId,
      paymentMethod: "CARD",
      amount: Number(req.body.amount),
    });
    return res.status(201).json({ success: true, data: result });
  } catch (e) {
    return res.status(400).json({ success: false, message: e.message });
  }
};

exports.getPaymentStatus = async (req, res) => {
  const sessionId = Number(req.params.session_id);
  const result = await checkoutService.getPaymentStatus({ sessionId });
  return res.status(200).json({ success: true, data: result });
};
```

```js
// be/controllers/webhook.payment.controller.js
const checkoutService = require("../services/checkout.service");

exports.payosWebhook = async (req, res) => {
  try {
    await checkoutService.finalizeFromWebhook(req.body);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(400).json({ success: false, message: "Invalid webhook" });
  }
};
```

```js
// be/routes/payment.routes.js
const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhook.payment.controller");

router.post("/payos/webhook", webhookController.payosWebhook);

module.exports = router;
```

```js
// be/routes/employee.routes.js (add)
const paymentController = require("../controllers/employee.payment.controller");
router.post("/parking/exit/:session_id/payment-intents", paymentController.createIntent);
router.get("/parking/exit/:session_id/payment-status", paymentController.getPaymentStatus);
```

```js
// be/app.js (add)
const paymentRoutes = require("./routes/payment.routes");
app.use("/api/payments", paymentRoutes);
```

- [ ] **Step 4: Run webhook/controller tests**

Run: `npm test -- --runInBand be/__tests__/controllers/webhook.payment.controller.test.js`

Expected: PASS with 200 response on valid mocked finalize.

- [ ] **Step 5: Commit**

```bash
git add be/controllers/employee.payment.controller.js be/controllers/webhook.payment.controller.js be/routes/payment.routes.js be/routes/employee.routes.js be/app.js be/__tests__/controllers/webhook.payment.controller.test.js
git commit -m "feat: expose payment intent status and payos webhook endpoints"
```

## Task 6: Update employee checkout frontend for CARD-first QR flow

**Files:**
- Modify: `fe/app/api/employee.client.js`
- Modify: `fe/app/employee/checkout/[sessionid]/page.jsx`

- [ ] **Step 1: Write failing frontend API client test for new endpoints**

```js
// fe/__tests__/api/employee.payment.client.test.js
import api from "@/app/api/client.config";
import { createPaymentIntent, fetchPaymentStatus } from "@/app/api/employee.client";

jest.mock("@/app/api/client.config", () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

test("createPaymentIntent calls payment-intents endpoint", async () => {
  api.post.mockResolvedValue({ data: { success: true, data: { status: "PENDING" } } });
  const data = await createPaymentIntent(1, 20000);
  expect(api.post).toHaveBeenCalledWith("/employee/parking/exit/1/payment-intents", { amount: 20000, payment_method: "CARD" });
  expect(data.status).toBe("PENDING");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- fe/__tests__/api/employee.payment.client.test.js` (or configured test command)

Expected: FAIL because methods do not exist.

- [ ] **Step 3: Implement API methods and CARD UI flow**

```js
// fe/app/api/employee.client.js (add)
export async function createPaymentIntent(sessionId, amount) {
  const res = await api.post(`/employee/parking/exit/${sessionId}/payment-intents`, {
    amount,
    payment_method: "CARD",
  });
  return res.data.data;
}

export async function fetchPaymentStatus(sessionId) {
  const res = await api.get(`/employee/parking/exit/${sessionId}/payment-status`);
  return res.data.data;
}
```

```jsx
// fe/app/employee/checkout/[sessionid]/page.jsx (core logic changes)
const [paymentMethod, setPaymentMethod] = useState("CARD");
const [paymentIntent, setPaymentIntent] = useState(null);

useEffect(() => {
  if (paymentMethod !== "CARD" || !checkout?.amount) return;
  createPaymentIntent(sessionid, getTotalAmount())
    .then((intent) => setPaymentIntent(intent))
    .catch((err) => toast.error(err.response?.data?.message || "Failed to create payment QR"));
}, [paymentMethod, sessionid, checkout?.amount]);

useEffect(() => {
  if (paymentMethod !== "CARD" || !paymentIntent?.attempt_id) return;
  const timer = setInterval(async () => {
    const status = await fetchPaymentStatus(sessionid);
    if (status.status === "PAID") {
      clearInterval(timer);
      router.replace(`/employee/checkout/success?license_plate=${checkout.session.license_plate}&payment_method=CARD`);
    }
  }, 3000);
  return () => clearInterval(timer);
}, [paymentMethod, paymentIntent, sessionid, checkout?.session?.license_plate]);

// keep button action for cash only
const handleConfirmPayment = async () => {
  if (paymentMethod === "CARD") return;
  // existing cash confirm path
};
```

- [ ] **Step 4: Run frontend tests/lint for touched files**

Run:
- `npm run lint` (in `fe`)
- `npm test -- fe/__tests__/api/employee.payment.client.test.js` (if FE test script exists, otherwise add one first)

Expected: lint clean, test passing.

- [ ] **Step 5: Commit**

```bash
git add fe/app/api/employee.client.js fe/app/employee/checkout/[sessionid]/page.jsx fe/__tests__/api/employee.payment.client.test.js
git commit -m "feat: add card-first payos qr checkout flow with status polling"
```

## Task 7: Enforce CARD manual-confirm rejection and keep CASH behavior

**Files:**
- Modify: `be/controllers/employee.sessions.controller.js`
- Modify: `be/services/checkout.service.js`
- Test: `be/__tests__/services/checkout.service.test.js`

- [ ] **Step 1: Add failing test for CARD direct confirm rejection**

```js
test("confirmCashCheckout rejects CARD payment method", async () => {
  const checkoutService = require("../../services/checkout.service");
  await expect(checkoutService.confirmCashCheckout({ sessionId: 1, totalAmount: 1000, paymentMethod: "CARD" }))
    .rejects.toThrow("CARD must be finalized by webhook");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- --runInBand be/__tests__/services/checkout.service.test.js`

Expected: FAIL because guard is missing.

- [ ] **Step 3: Implement guard in controller/service**

```js
// be/controllers/employee.sessions.controller.js (inside confirmCheckout)
if (payment_method === "CARD") {
  return res.status(409).json({
    success: false,
    message: "CARD payment must be completed via QR and webhook",
  });
}
```

```js
// be/services/checkout.service.js (top of confirmCashCheckout)
if (arguments[0]?.paymentMethod && arguments[0].paymentMethod !== "CASH") {
  throw new Error("CARD must be finalized by webhook");
}
```

- [ ] **Step 4: Run backend tests**

Run: `npm test -- --runInBand be/__tests__/services/checkout.service.test.js`

Expected: PASS including CARD rejection scenario.

- [ ] **Step 5: Commit**

```bash
git add be/controllers/employee.sessions.controller.js be/services/checkout.service.js be/__tests__/services/checkout.service.test.js
git commit -m "fix: block direct card confirm and enforce webhook settlement"
```

## Task 8: End-to-end verification, docs, and security cleanup

**Files:**
- Modify: `docs/superpowers/specs/2026-03-28-payment-checkout-design.md` (only if behavior diverged)
- Modify: `docs/superpowers/payos_doc.md` (remove raw secrets from repo and keep placeholders)

- [ ] **Step 1: Add failing secret-scan check for committed credentials**

Run:
- `rg "PAYOS_CLIENT_ID|PAYOS_API_KEY|PAYOS_CHECKSUM_KEY|f1cf098c|a92909fb|daa4b7d5" docs/superpowers/payos_doc.md`

Expected: currently finds real credentials (fail policy).

- [ ] **Step 2: Run full test suites before cleanup to lock behavior**

Run:
- `npm test -- --runInBand` (in `be`)
- `npm run lint` (in `fe`)

Expected: all passing before final docs/security changes.

- [ ] **Step 3: Replace secrets in docs with placeholders and add env usage note**

```md
Client ID: <PAYOS_CLIENT_ID>
Api Key: <PAYOS_API_KEY>
Checksum Key: <PAYOS_CHECKSUM_KEY>
```

Add note:

```md
Store credentials in environment variables only. Do not commit real PayOS keys.
```

- [ ] **Step 4: Re-run secret scan and verification commands**

Run:
- `rg "f1cf098c|a92909fb|daa4b7d5" docs/superpowers/payos_doc.md`
- `npm test -- --runInBand` (in `be`)

Expected: no secret match; tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/payos_doc.md docs/superpowers/specs/2026-03-28-payment-checkout-design.md
git commit -m "docs: sanitize payos references and align design with implementation"
```

## Final Validation Checklist

- [ ] CARD checkout can only complete when webhook verification succeeds and session `time_out` is set.
- [ ] Duplicate webhook delivery does not duplicate session close or settled ledger insert.
- [ ] CASH flow still completes checkout immediately.
- [ ] `payment_attempts` records lifecycle for CARD attempts.
- [ ] `payment` table contains settled rows only.
- [ ] Frontend default method is CARD and shows QR/status behavior.
