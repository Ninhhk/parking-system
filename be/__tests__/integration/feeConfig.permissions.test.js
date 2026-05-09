// Feature: fee-calculation-engine
// Permission check HTTP tests for POST /api/admin/fee-config/versions
// Requirements: 11.2, 11.3

jest.mock("../../config/db", () => ({
    pool: { query: jest.fn(), connect: jest.fn() },
    connectDB: jest.fn(),
}));

jest.mock("../../services/admin.feeConfig.service", () => ({
    createFeeConfigVersion: jest.fn(),
    getActiveFeeConfigs: jest.fn(),
    getFeeConfigVersions: jest.fn(),
}));

// Module-level store — must be prefixed with "mock" to be accessible inside jest.mock() factories
const mockPermissionsStore = { current: {} };

jest.mock("../../middlewares/auth.middleware", () => ({
    isAuthenticated: (req, res, next) => {
        req.session = req.session || {};
        req.session.user = { user_id: 1, role: "admin", permissions: mockPermissionsStore.current };
        next();
    },
    hasRole: () => (req, res, next) => next(),
    hasAnyRole: () => (req, res, next) => next(),
    isNotAuthenticated: (req, res, next) => next(),
    hasPermission: (claim) => (req, res, next) => {
        if (mockPermissionsStore.current[claim] === true) return next();
        return res.status(403).json({ message: "Forbidden. You do not have the required permissions." });
    },
}));

const request = require("supertest");
const app = require("../../app");
const adminFeeConfigService = require("../../services/admin.feeConfig.service");

const validPayload = {
    vehicle_type: "car",
    effective_from: "2025-01-01T00:00:00Z",
    rounding_strategy: "ceil_hour",
    grace_period_minutes: 0,
    hourly_rate: 10000,
    daily_cap_enabled: false,
    daily_cap_amount: 0,
    tiered_rate_enabled: false,
    tiers: [],
    time_of_day_enabled: false,
    time_windows: [],
    penalty_fee: 50000,
};

describe("POST /api/admin/fee-config/versions — permission checks", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPermissionsStore.current = {};
    });

    it("returns 403 when user does not have can_edit_fees", async () => {
        mockPermissionsStore.current = {};

        const res = await request(app)
            .post("/api/admin/fee-config/versions")
            .send(validPayload)
            .set("Content-Type", "application/json");

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/Forbidden/);
    });

    it("returns 201 when user has can_edit_fees = true", async () => {
        mockPermissionsStore.current = { can_edit_fees: true };

        const createdRow = { ...validPayload, config_version_id: 42, created_at: new Date().toISOString() };
        adminFeeConfigService.createFeeConfigVersion.mockResolvedValue(createdRow);

        const res = await request(app)
            .post("/api/admin/fee-config/versions")
            .send(validPayload)
            .set("Content-Type", "application/json");

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.config_version_id).toBe(42);
    });
});
