/**
 * Unit tests — subscription lookup repository (findActiveByCardUid)
 *
 * The "active" window is enforced in SQL: a subscription is active when
 *   start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
 * Both comparisons are inclusive, so a subscription whose start_date is today
 * or whose end_date is today is still active. These tests pin that inclusive
 * boundary in the query and verify row passthrough.
 *
 * Validates: Requirements 5.1, 5.4
 */

const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: { query: (...args) => mockPoolQuery(...args) },
}));

const { findActiveByCardUid } = require("../../repositories/employee.subscription.repo");

describe("employee.subscription.repo — findActiveByCardUid", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("queries with inclusive CURRENT_DATE boundaries (start today / end today are active)", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        await findActiveByCardUid("CARD-001");

        const [sql, params] = mockPoolQuery.mock.calls[0];
        // Inclusive on both ends: start_date = today and end_date = today still match.
        expect(sql).toMatch(/start_date\s*<=\s*CURRENT_DATE/);
        expect(sql).toMatch(/end_date\s*>=\s*CURRENT_DATE/);
        expect(params).toEqual(["CARD-001"]);
    });

    it("selects exactly the fields the kiosk consumes", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        await findActiveByCardUid("CARD-001");

        const [sql] = mockPoolQuery.mock.calls[0];
        expect(sql).toMatch(/sub_id/);
        expect(sql).toMatch(/vehicle_type/);
        expect(sql).toMatch(/owner_name/);
        expect(sql).toMatch(/start_date/);
        expect(sql).toMatch(/end_date/);
    });

    it("returns the matching active subscription row", async () => {
        const row = {
            sub_id: 7,
            vehicle_type: "bike",
            owner_name: "Tran Thi B",
            start_date: "2025-06-01",
            end_date: "2025-12-31",
        };
        mockPoolQuery.mockResolvedValue({ rows: [row] });

        const result = await findActiveByCardUid("CARD-007");

        expect(result).toEqual(row);
    });

    it("returns null when no active subscription matches the card", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await findActiveByCardUid("EXPIRED-CARD");

        expect(result).toBeNull();
    });
});
