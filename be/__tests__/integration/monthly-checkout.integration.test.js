// Integration tests for the monthly/subscription one-tap checkout endpoint:
//   POST /api/employee/parking/exit/:session_id/monthly-checkout
//
// Covers the server-side eligibility gate (only an active monthly session that owes
// nothing may exit for free), the distinct MONTHLY ledger method, and idempotency of a
// double-tap. Deps are mocked (no Docker DB) — same harness style as
// monthlysubs.fixes.integration.test.js.

jest.mock("../../config/db", () => ({
    pool: { query: jest.fn(), connect: jest.fn() },
    connectDB: jest.fn(),
}));

jest.mock("express-session", () => () => (req, res, next) => next());

jest.mock("../../middlewares/auth.middleware", () => ({
    isAuthenticated: (req, res, next) => {
        req.session = { user: { user_id: 1, role: "employee" } };
        next();
    },
    hasRole: () => (req, res, next) => next(),
    hasAnyRole: () => (req, res, next) => next(),
    isNotAuthenticated: (req, res, next) => next(),
    hasPermission: () => (req, res, next) => next(),
}));

jest.mock("../../repositories/employee.sessions.repo", () => ({
    getSession: jest.fn(),
    syncLostTicketStatus: jest.fn(),
    updateSessionImageUrl: jest.fn(),
}));

jest.mock("../../services/feeCalculation.service", () => ({
    calculateAndValidateFee: jest.fn(),
}));

jest.mock("../../services/checkout.service", () => ({
    settleCheckout: jest.fn(),
    createIntent: jest.fn(),
    getPaymentStatus: jest.fn(),
}));

const sessionsRepo = require("../../repositories/employee.sessions.repo");
const feeCalculationService = require("../../services/feeCalculation.service");
const checkoutService = require("../../services/checkout.service");

const request = require("supertest");
const app = require("../../app");

const URL = (id) => `/api/employee/parking/exit/${id}/monthly-checkout`;

function makeSession(overrides = {}) {
    return {
        session_id: 344,
        lot_id: 10,
        license_plate: "51F-12345",
        card_uid: "CARD-MONTHLY-1",
        vehicle_type: "car",
        is_monthly: true,
        time_in: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        time_out: null,
        is_lost: false,
        parking_fee: 0,
        ...overrides,
    };
}

const FEE_FREE = { success: true, totalAmount: 0, serviceFee: 0, penaltyFee: 0, hours: 2 };

beforeEach(() => {
    jest.clearAllMocks();
    sessionsRepo.syncLostTicketStatus.mockResolvedValue(false);
});

describe("POST /parking/exit/:id/monthly-checkout", () => {
    it("finalizes a fee-waived monthly session and records the MONTHLY method", async () => {
        sessionsRepo.getSession.mockResolvedValue(makeSession());
        feeCalculationService.calculateAndValidateFee.mockResolvedValue(FEE_FREE);
        checkoutService.settleCheckout.mockResolvedValue({ ok: true, finalized: true });

        const res = await request(app).post(URL(344)).send({});

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.payment.method).toBe("MONTHLY");
        expect(res.body.payment.amount).toBe(0);
        expect(res.body.payment.already_finalized).toBe(false);
        expect(checkoutService.settleCheckout).toHaveBeenCalledWith(
            expect.objectContaining({ sessionId: 344, totalAmount: 0, paymentMethod: "MONTHLY" })
        );
    });

    it("rejects a non-monthly session (409) without finalizing", async () => {
        sessionsRepo.getSession.mockResolvedValue(makeSession({ is_monthly: false }));

        const res = await request(app).post(URL(344)).send({});

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(feeCalculationService.calculateAndValidateFee).not.toHaveBeenCalled();
        expect(checkoutService.settleCheckout).not.toHaveBeenCalled();
    });

    it("rejects a monthly session that still owes money (409) — e.g. lost-ticket penalty", async () => {
        sessionsRepo.getSession.mockResolvedValue(makeSession({ is_lost: true }));
        feeCalculationService.calculateAndValidateFee.mockResolvedValue({
            success: true,
            totalAmount: 50000,
            serviceFee: 0,
            penaltyFee: 50000,
            hours: 2,
        });

        const res = await request(app).post(URL(344)).send({});

        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/outstanding balance/i);
        expect(checkoutService.settleCheckout).not.toHaveBeenCalled();
    });

    it("returns 400 when the session is already checked out", async () => {
        sessionsRepo.getSession.mockResolvedValue(makeSession({ time_out: new Date().toISOString() }));

        const res = await request(app).post(URL(344)).send({});

        expect(res.status).toBe(400);
        expect(checkoutService.settleCheckout).not.toHaveBeenCalled();
    });

    it("returns 404 when the session does not exist", async () => {
        sessionsRepo.getSession.mockResolvedValue(null);

        const res = await request(app).post(URL(999)).send({});

        expect(res.status).toBe(404);
        expect(checkoutService.settleCheckout).not.toHaveBeenCalled();
    });

    it("is idempotent: a losing double-tap reports already_finalized", async () => {
        const open = makeSession();
        const finalized = makeSession({ time_out: new Date().toISOString() });
        // First read (eligibility) sees the open session; settle loses the race
        // (finalized:false); the re-read returns the time_out set by the winner.
        sessionsRepo.getSession.mockResolvedValueOnce(open).mockResolvedValueOnce(finalized);
        feeCalculationService.calculateAndValidateFee.mockResolvedValue(FEE_FREE);
        checkoutService.settleCheckout.mockResolvedValue({ ok: true, finalized: false });

        const res = await request(app).post(URL(344)).send({});

        expect(res.status).toBe(200);
        expect(res.body.payment.already_finalized).toBe(true);
        expect(res.body.session.time_out).toBe(finalized.time_out);
    });
});
