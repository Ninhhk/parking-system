/**
 * Bug 1 — Fix verification test (runs against FIXED code)
 *
 * Purpose: Confirm that checkMonthlySub now filters by vehicle_type.
 * A car subscription row must NOT be returned when the caller is a bike check-in,
 * proving the fix is in place.
 *
 * EXPECTED OUTCOME: Test PASSES — it asserts the fixed behavior (the row is NOT
 * returned when vehicle_type does not match).
 *
 * Validates: Requirements 1.1, 1.2
 */

const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
}));

const { checkMonthlySub } = require("../../repositories/employee.sessions.repo");

describe("Bug 1 — checkMonthlySub vehicle_type filter (fix verification)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns undefined for plate TEST-001 when vehicle_type does not match the subscription", async () => {
        // Arrange: pool returns a car subscription for plate TEST-001
        const carSubRow = {
            sub_id: 1,
            license_plate: "TEST-001",
            vehicle_type: "car",
            start_date: "2025-01-01",
            end_date: "2025-12-31",
            owner_name: "Test Owner",
            owner_phone: "0900000000",
        };
        // The DB now filters by vehicle_type, so a bike query returns no rows
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const today = new Date().toISOString().split("T")[0];

        // Act: call with new 3-arg signature — bike check-in against a car subscription
        const result = await checkMonthlySub("TEST-001", "bike", today);

        // Assert: no row returned — the vehicle_type filter is now applied
        expect(result).toBeUndefined();

        // Confirm the query now includes vehicle_type = $2 and params include vehicle_type
        const [calledQuery, calledParams] = mockPoolQuery.mock.calls[0];
        expect(calledQuery).toMatch(/vehicle_type\s*=\s*\$2/i);
        expect(calledParams).toEqual(["TEST-001", "bike", today]);
    });
});
