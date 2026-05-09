// Bug 3 Fix Verification Test — confirms PUT /api/admin/monthly-subs/:id returns 200 after fix
// Property 1: Expected Behavior — PUT route registered, sub_id preserved
// Validates: Requirements 3.1, 3.2

jest.mock("../../config/db", () => ({
    pool: { query: jest.fn(), connect: jest.fn() },
    connectDB: jest.fn(),
}));

// Mock express-session so it never touches req.session.cookie
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

jest.mock("../../repositories/admin.monthlysubs.repo", () => ({
    getMonthlySubById: jest.fn().mockResolvedValue({
        sub_id: 1,
        license_plate: "ABC-123",
        vehicle_type: "car",
        start_date: "2025-01-01",
        end_date: "2025-06-30",
        owner_name: "Alice",
        owner_phone: "0812345678",
    }),
    checkExistingSubExcluding: jest.fn().mockResolvedValue("0"),
    updateMonthlySub: jest.fn().mockResolvedValue({
        sub_id: 1,
        license_plate: "ABC-123",
        vehicle_type: "car",
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        owner_name: "Alice",
        owner_phone: "0812345678",
    }),
    getAllMonthlySubs: jest.fn(),
    createMonthlySub: jest.fn(),
    checkExistingSub: jest.fn(),
    deleteMonthlySub: jest.fn(),
}));

const request = require("supertest");
const app = require("../../app");

describe("Bug 3 fix verification — PUT /api/admin/monthly-subs/:id exists and preserves sub_id", () => {
    it("returns 200 and data.sub_id matching the input id after fix", async () => {
        const res = await request(app)
            .put("/api/admin/monthly-subs/1")
            .send({ end_date: "2025-12-31" })
            .set("Content-Type", "application/json");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.sub_id).toBe(1);
    });
});
