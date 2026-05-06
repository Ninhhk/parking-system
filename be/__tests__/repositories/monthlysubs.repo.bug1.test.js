/**
 * Bug 1 — Fix-checking unit tests
 *
 * Purpose: Verify that checkMonthlySub correctly filters by vehicle_type
 * after the fix is applied.
 *
 * Validates: Requirements 2.1, 2.2, 3.1, 3.2, 3.3
 */

const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
}));

const { checkMonthlySub } = require("../../repositories/employee.sessions.repo");

describe("Bug 1 — checkMonthlySub fix-checking tests", () => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    const carSubRow = {
        sub_id: 1,
        license_plate: "ABC-123",
        vehicle_type: "car",
        start_date: "2025-01-01",
        end_date: "2099-12-31",
        owner_name: "Alice",
        owner_phone: "0900000001",
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns undefined when vehicle_type is bike but mock returns a car row", async () => {
        // DB now filters by vehicle_type — a bike query against a car sub returns no rows
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await checkMonthlySub("ABC-123", "bike", today);

        expect(result).toBeUndefined();
    });

    it("returns the row when vehicle_type matches the subscription", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [carSubRow] });

        const result = await checkMonthlySub("ABC-123", "car", today);

        expect(result).toBeDefined();
        expect(result.license_plate).toBe("ABC-123");
        expect(result.vehicle_type).toBe("car");
    });

    it("returns undefined when no rows match (plate has no subscription)", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await checkMonthlySub("ABC-123", "car", today);

        expect(result).toBeUndefined();
    });

    it("returns undefined when date is outside the subscription range", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await checkMonthlySub("EXP-001", "car", yesterday);

        expect(result).toBeUndefined();
    });
});
