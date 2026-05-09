// Integration tests covering all three MonthlySubs bug fixes
// Bug 1: checkMonthlySub now filters by vehicle_type
// Bug 2: checkInByRfid now performs subscription lookup via checkMonthlySubByCard
// Bug 3: PUT /api/admin/monthly-subs/:id preserves sub_id and leaves Payment rows intact
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.4

jest.mock("../../config/db", () => ({
    pool: { query: jest.fn(), connect: jest.fn() },
    connectDB: jest.fn(),
}));

jest.mock("express-session", () => () => (req, res, next) => next());

jest.mock("../../middlewares/auth.middleware", () => ({
    isAuthenticated: (req, res, next) => {
        req.session = { user: { user_id: 1, role: "admin" } };
        next();
    },
    hasRole: () => (req, res, next) => next(),
    hasAnyRole: () => (req, res, next) => next(),
    isNotAuthenticated: (req, res, next) => next(),
    hasPermission: () => (req, res, next) => next(),
}));

// Jest hoists jest.mock() calls, so factories must not reference variables defined
// in module scope. Use jest.fn() stubs inline and reassign in beforeEach.
jest.mock("../../repositories/employee.sessions.repo", () => ({
    checkMonthlySub: jest.fn(),
    checkMonthlySubByCard: jest.fn(),
    startSession: jest.fn(),
    getSession: jest.fn(),
    syncLostTicketStatus: jest.fn(),
}));

jest.mock("../../repositories/admin.lots.repo", () => ({
    getParkingLotByManager: jest.fn(),
    getAllParkingLots: jest.fn(),
}));

jest.mock("../../repositories/admin.monthlysubs.repo", () => ({
    getMonthlySubById: jest.fn(),
    checkExistingSubExcluding: jest.fn(),
    updateMonthlySub: jest.fn(),
    getAllMonthlySubs: jest.fn(),
    createMonthlySub: jest.fn(),
    checkExistingSub: jest.fn(),
    deleteMonthlySub: jest.fn(),
}));

jest.mock("../../repositories/admin.payments.repo", () => ({
    getAllPayments: jest.fn(),
    createMonthlyPayment: jest.fn(),
}));

jest.mock("../../repositories/feeConfig.repo", () => ({
    getActiveConfig: jest.fn(),
}));

jest.mock("../../services/feeCalculation.service", () => ({
    calculateAndValidateFee: jest.fn(),
}));

jest.mock("../../services/checkout.service", () => ({
    confirmCashCheckout: jest.fn(),
    createIntent: jest.fn(),
    getPaymentStatus: jest.fn(),
}));

// Require mocked modules after jest.mock() declarations
const sessionsRepo = require("../../repositories/employee.sessions.repo");
const lotsRepo = require("../../repositories/admin.lots.repo");
const subsRepo = require("../../repositories/admin.monthlysubs.repo");
const feeConfigRepo = require("../../repositories/feeConfig.repo");
const checkoutService = require("../../services/checkout.service");
const feeCalculationService = require("../../services/feeCalculation.service");

const request = require("supertest");
const app = require("../../app");

// ── helpers ────────────────────────────────────────────────────────────────────

const FAKE_LOT = { lot_id: 10, lot_name: "Test Lot", car_capacity: 50, bike_capacity: 50 };

function makeSession(overrides = {}) {
    return {
        session_id: 100,
        lot_id: FAKE_LOT.lot_id,
        license_plate: null,
        card_uid: null,
        vehicle_type: "car",
        is_monthly: false,
        time_in: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 h ago
        time_out: null,
        is_lost: false,
        parking_fee: 0,
        ...overrides,
    };
}

function makeFeeConfig(overrides = {}) {
    return {
        config_version_id: 1,
        vehicle_type: "car",
        effective_from: "2020-01-01T00:00:00Z",
        rounding_strategy: "ceil_hour",
        grace_period_minutes: 0,
        hourly_rate: 5000,
        daily_cap_enabled: false,
        daily_cap_amount: 0,
        tiered_rate_enabled: false,
        tiers: [],
        time_of_day_enabled: false,
        time_windows: [],
        penalty_fee: 50000,
        ...overrides,
    };
}

// ── setup / teardown ───────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();

    // Default lot resolution
    lotsRepo.getParkingLotByManager.mockResolvedValue(FAKE_LOT);
    lotsRepo.getAllParkingLots.mockResolvedValue([FAKE_LOT]);

    // Default startSession returns a minimal session row
    sessionsRepo.startSession.mockImplementation(async (payload) =>
        makeSession({
            session_id: 100,
            lot_id: payload.lot_id,
            license_plate: payload.license_plate,
            card_uid: payload.card_uid || null,
            vehicle_type: payload.vehicle_type,
            is_monthly: payload.is_monthly,
        })
    );

    // Default: no active subscription
    sessionsRepo.checkMonthlySub.mockResolvedValue(undefined);
    sessionsRepo.checkMonthlySubByCard.mockResolvedValue(undefined);

    // Default fee config
    feeConfigRepo.getActiveConfig.mockResolvedValue(makeFeeConfig());

    // Default fee calculation: non-monthly 2h × 5000 = 10000
    // Note: the controller calls calculateAndValidateFee without await, so the mock
    // must return a plain object (not a Promise) to match the controller's expectation.
    feeCalculationService.calculateAndValidateFee.mockImplementation((session) => {
        if (session.is_monthly) {
            return { success: true, totalAmount: 0, serviceFee: 0, penaltyFee: 0, hours: 2 };
        }
        return { success: true, totalAmount: 10000, serviceFee: 10000, penaltyFee: 0, hours: 2 };
    });

    // Default syncLostTicketStatus
    sessionsRepo.syncLostTicketStatus.mockResolvedValue(false);
});

// ══════════════════════════════════════════════════════════════════════════════
// Bug 1 — vehicle_type filter on plate-based check-in
// ══════════════════════════════════════════════════════════════════════════════

describe("Bug 1 — plate check-in respects vehicle_type filter", () => {
    // Use plates that survive sanitizePlate (no B→8, O→0, I→1, Z→2, S→5 substitutions)
    const PLATE = "CAR-123";   // 'C','A','R' are safe; sanitized: "CAR-123"

    it("car sub active for plate X, bike checks in → session is_monthly: false (Req 2.1, 2.2)", async () => {
        // checkMonthlySub returns undefined because vehicle_type = 'bike' does not match the car sub
        sessionsRepo.checkMonthlySub.mockResolvedValue(undefined);

        const res = await request(app)
            .post("/api/employee/parking/entry")
            .send({ license_plate: PLATE, vehicle_type: "bike" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.ticket.is_monthly).toBe(false);

        // Verify checkMonthlySub was called with the correct 3-arg signature
        expect(sessionsRepo.checkMonthlySub).toHaveBeenCalledWith(
            PLATE,
            "bike",
            expect.any(String)
        );

        // Verify startSession received is_monthly: false
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({ is_monthly: false })
        );
    });

    it("car sub active for plate X, car checks in → session is_monthly: true (Req 3.1)", async () => {
        const carSub = {
            sub_id: 5,
            license_plate: PLATE,
            vehicle_type: "car",
            start_date: "2025-01-01",
            end_date: "2099-12-31",
        };
        // checkMonthlySub returns the row because vehicle_type matches
        sessionsRepo.checkMonthlySub.mockResolvedValue(carSub);

        const res = await request(app)
            .post("/api/employee/parking/entry")
            .send({ license_plate: PLATE, vehicle_type: "car" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.ticket.is_monthly).toBe(true);

        expect(sessionsRepo.checkMonthlySub).toHaveBeenCalledWith(
            PLATE,
            "car",
            expect.any(String)
        );

        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({ is_monthly: true })
        );
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// Bug 2 — RFID check-in performs subscription lookup
// ══════════════════════════════════════════════════════════════════════════════

describe("Bug 2 — RFID check-in subscription lookup", () => {
    it("card linked to active sub → session is_monthly: true; checkout waives fee (Req 2.3, 3.4)", async () => {
        const cardSub = {
            sub_id: 7,
            card_uid: "CARD-001",
            vehicle_type: "car",
            start_date: "2025-01-01",
            end_date: "2099-12-31",
        };
        sessionsRepo.checkMonthlySubByCard.mockResolvedValue(cardSub);

        // startSession returns a monthly session
        const monthlySession = makeSession({
            session_id: 200,
            card_uid: "CARD-001",
            license_plate: null,
            vehicle_type: "car",
            is_monthly: true,
        });
        sessionsRepo.startSession.mockResolvedValue(monthlySession);

        // Check-in
        const checkInRes = await request(app)
            .post("/api/employee/parking/entry/rfid")
            .send({ card_uid: "CARD-001", vehicle_type: "car" })
            .set("Content-Type", "application/json");

        expect(checkInRes.status).toBe(201);
        expect(checkInRes.body.success).toBe(true);
        expect(checkInRes.body.ticket.is_monthly).toBe(true);

        expect(sessionsRepo.checkMonthlySubByCard).toHaveBeenCalledWith(
            "CARD-001",
            "car",
            expect.any(String)
        );
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({ is_monthly: true })
        );

        // Checkout — monthly subscriber should get parking_fee = 0
        sessionsRepo.getSession.mockResolvedValue({
            ...monthlySession,
            lot_name: FAKE_LOT.lot_name,
            service_fee: 5000,
            penalty_fee: 50000,
        });
        sessionsRepo.syncLostTicketStatus.mockResolvedValue(false);
        checkoutService.confirmCashCheckout.mockResolvedValue({ ok: true, finalized: true });

        const checkOutRes = await request(app)
            .post("/api/employee/parking/exit/confirm")
            .send({ session_id: 200, payment_method: "CASH" })
            .set("Content-Type", "application/json");

        expect(checkOutRes.status).toBe(200);
        expect(checkOutRes.body.success).toBe(true);

        // confirmCashCheckout should have been called with totalAmount = 0 (monthly waives fee)
        expect(checkoutService.confirmCashCheckout).toHaveBeenCalledWith(
            expect.objectContaining({ totalAmount: 0 })
        );
    });

    it("card with no sub → session is_monthly: false; checkout charges normal fee (Req 2.4)", async () => {
        sessionsRepo.checkMonthlySubByCard.mockResolvedValue(undefined);

        const nonMonthlySession = makeSession({
            session_id: 201,
            card_uid: "CARD-002",
            license_plate: null,
            vehicle_type: "car",
            is_monthly: false,
        });
        sessionsRepo.startSession.mockResolvedValue(nonMonthlySession);

        // Check-in
        const checkInRes = await request(app)
            .post("/api/employee/parking/entry/rfid")
            .send({ card_uid: "CARD-002", vehicle_type: "car" })
            .set("Content-Type", "application/json");

        expect(checkInRes.status).toBe(201);
        expect(checkInRes.body.success).toBe(true);
        expect(checkInRes.body.ticket.is_monthly).toBe(false);

        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({ is_monthly: false })
        );

        // Checkout — non-monthly should be charged the hourly rate
        sessionsRepo.getSession.mockResolvedValue({
            ...nonMonthlySession,
            lot_name: FAKE_LOT.lot_name,
            service_fee: 5000,
            penalty_fee: 50000,
        });
        sessionsRepo.syncLostTicketStatus.mockResolvedValue(false);
        checkoutService.confirmCashCheckout.mockResolvedValue({ ok: true, finalized: true });

        const checkOutRes = await request(app)
            .post("/api/employee/parking/exit/confirm")
            .send({ session_id: 201, payment_method: "CASH" })
            .set("Content-Type", "application/json");

        expect(checkOutRes.status).toBe(200);
        expect(checkOutRes.body.success).toBe(true);

        // Non-monthly: totalAmount should be > 0 (2 h × 5000 = 10000)
        expect(checkoutService.confirmCashCheckout).toHaveBeenCalledWith(
            expect.objectContaining({ totalAmount: expect.any(Number) })
        );
        const { totalAmount } = checkoutService.confirmCashCheckout.mock.calls[0][0];
        expect(totalAmount).toBeGreaterThan(0);
    });
});

// ══════════════════════════════════════════════════════════════════════════════
// Bug 3 — PUT /api/admin/monthly-subs/:id preserves sub_id
// ══════════════════════════════════════════════════════════════════════════════

describe("Bug 3 — PUT /api/admin/monthly-subs/:id preserves sub_id and Payment references", () => {
    it("update end_date → response sub_id matches original; Payment rows reference same sub_id (Req 2.5, 2.6)", async () => {
        const originalSub = {
            sub_id: 42,
            license_plate: "XYZ-999",
            vehicle_type: "car",
            start_date: "2025-01-01",
            end_date: "2025-06-30",
            owner_name: "Wawan",
            owner_phone: "0899999999",
        };

        const updatedSub = {
            ...originalSub,
            end_date: "2025-12-31",
        };

        subsRepo.getMonthlySubById.mockResolvedValue(originalSub);
        subsRepo.checkExistingSubExcluding.mockResolvedValue("0");
        subsRepo.updateMonthlySub.mockResolvedValue(updatedSub);

        const res = await request(app)
            .put("/api/admin/monthly-subs/42")
            .send({ end_date: "2025-12-31" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // sub_id in response must equal the original sub_id (record updated in place)
        expect(res.body.data.sub_id).toBe(originalSub.sub_id);

        // updateMonthlySub was called with the same id — no new record created
        expect(subsRepo.updateMonthlySub).toHaveBeenCalledWith(
            "42",
            expect.objectContaining({ end_date: "2025-12-31" })
        );

        // Payment rows: the sub_id used in the Payment table is the original sub_id.
        // Since we update in place (no delete + recreate), the sub_id never changes,
        // so any Payment row with sub_id = 42 remains valid.
        // We verify this by confirming updateMonthlySub (not createMonthlySub) was called.
        expect(subsRepo.createMonthlySub).not.toHaveBeenCalled();
        expect(res.body.data.sub_id).toBe(42);
    });

    it("returns 404 when sub_id does not exist (Req 2.5)", async () => {
        subsRepo.getMonthlySubById.mockResolvedValue(undefined);

        const res = await request(app)
            .put("/api/admin/monthly-subs/999")
            .send({ end_date: "2025-12-31" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it("returns 409 when new end_date overlaps another subscription (Req 2.6)", async () => {
        const existingSub = {
            sub_id: 42,
            license_plate: "XYZ-999",
            vehicle_type: "car",
            start_date: "2025-01-01",
            end_date: "2025-06-30",
            owner_name: "Wawan",
            owner_phone: "0899999999",
        };

        subsRepo.getMonthlySubById.mockResolvedValue(existingSub);
        // Overlap detected
        subsRepo.checkExistingSubExcluding.mockResolvedValue("1");

        const res = await request(app)
            .put("/api/admin/monthly-subs/42")
            .send({ end_date: "2025-12-31" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });
});
