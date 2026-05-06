/**
 * Bug 1 — Preservation tests (runs against FIXED code)
 *
 * Purpose: Verify that correct behaviors from checkMonthlySub are preserved
 * after the fix. Uses the new 3-arg signature where vehicle_type matches
 * the mocked row.
 *
 * EXPECTED OUTCOME: All three tests PASS (no regressions).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.7
 */

const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
}));

const { checkMonthlySub } = require("../../repositories/employee.sessions.repo");

describe("Bug 1 — checkMonthlySub preservation (fixed code)", () => {
    const today = new Date().toISOString().split("T")[0];

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns the subscription row when plate and vehicle_type match an active date range", async () => {
        const subRow = {
            sub_id: 1,
            license_plate: "ABC-123",
            vehicle_type: "car",
            start_date: "2025-01-01",
            end_date: "2099-12-31",
            owner_name: "Alice",
            owner_phone: "0900000001",
        };
        mockPoolQuery.mockResolvedValue({ rows: [subRow] });

        const result = await checkMonthlySub("ABC-123", "car", today);

        expect(result).toBeDefined();
        expect(result.license_plate).toBe("ABC-123");
    });

    it("returns undefined when the plate has no subscription", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await checkMonthlySub("ZZZ-000", "car", today);

        expect(result).toBeUndefined();
    });

    it("returns undefined when the subscription is expired", async () => {
        // DB filters by date in the WHERE clause, so no rows are returned
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await checkMonthlySub("EXP-001", "car", "2025-01-01");

        expect(result).toBeUndefined();
    });
});
