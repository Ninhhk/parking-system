const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: {
        query: (...args) => mockPoolQuery(...args),
    },
}));

const parkingCardsRepo = require("../../repositories/parkingCards.repo");

describe("parkingCards.repo getPoolCard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPoolQuery.mockResolvedValue({ rows: [] });
    });

    // Validates: Requirements 9.1
    it("looks up a card keyed by global card_uid", async () => {
        const row = {
            card_uid: "POOL-001",
            lot_id: null,
            status: "available",
            created_at: "2026-01-01T00:00:00.000Z",
        };
        mockPoolQuery.mockResolvedValue({ rows: [row] });

        const result = await parkingCardsRepo.getPoolCard("POOL-001");

        expect(mockPoolQuery).toHaveBeenCalledTimes(1);
        const [sql, params] = mockPoolQuery.mock.calls[0];
        expect(sql).toContain("SELECT card_uid, lot_id, status, created_at");
        expect(sql).toContain("FROM parking_cards");
        expect(sql).toContain("WHERE card_uid = $1");
        expect(params).toEqual(["POOL-001"]);
        expect(result).toEqual(row);
    });

    // Validates: Requirements 9.2
    it("returns null without raising when the card does not exist", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await parkingCardsRepo.getPoolCard("MISSING");

        expect(result).toBeNull();
    });
});

describe("parkingCards.repo markLost", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPoolQuery.mockResolvedValue({ rows: [] });
    });

    // Validates: Requirements 9.3
    it("issues an UPDATE setting status='lost' keyed by card_uid", async () => {
        await parkingCardsRepo.markLost("POOL-001");

        expect(mockPoolQuery).toHaveBeenCalledTimes(1);

        const [sql, params] = mockPoolQuery.mock.calls[0];
        expect(sql).toContain("UPDATE parking_cards");
        expect(sql).toContain("status = 'lost'");
        expect(sql).toContain("WHERE card_uid = $1");
        expect(params).toEqual(["POOL-001"]);
    });
});

describe("parkingCards.repo setStatus", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("updates status keyed by card_uid and returns the updated row", async () => {
        const row = {
            card_uid: "POOL-001",
            lot_id: 1,
            status: "lost",
            created_at: "2026-01-01T00:00:00.000Z",
        };
        mockPoolQuery.mockResolvedValue({ rows: [row] });

        const result = await parkingCardsRepo.setStatus("POOL-001", "lost");

        const [sql, params] = mockPoolQuery.mock.calls[0];
        expect(sql).toContain("UPDATE parking_cards");
        expect(sql).toContain("WHERE card_uid = $1");
        expect(params).toEqual(["POOL-001", "lost"]);
        expect(result).toEqual(row);
    });

    // Validates: Requirements 9.2 (no-match returns null, surfaced as 404 by the service)
    it("returns null when no card matched (0 rows)", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await parkingCardsRepo.setStatus("MISSING", "lost");

        expect(result).toBeNull();
    });
});

describe("parkingCards.repo deletePoolCard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("deletes keyed by card_uid and returns the deleted row", async () => {
        const row = {
            card_uid: "POOL-001",
            lot_id: 1,
            status: "available",
            created_at: "2026-01-01T00:00:00.000Z",
        };
        mockPoolQuery.mockResolvedValue({ rows: [row] });

        const result = await parkingCardsRepo.deletePoolCard("POOL-001");

        const [sql, params] = mockPoolQuery.mock.calls[0];
        expect(sql).toContain("DELETE FROM parking_cards");
        expect(sql).toContain("WHERE card_uid = $1");
        expect(params).toEqual(["POOL-001"]);
        expect(result).toEqual(row);
    });

    it("returns null when no card matched (0 rows)", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [] });

        const result = await parkingCardsRepo.deletePoolCard("MISSING");

        expect(result).toBeNull();
    });
});

describe("parkingCards.repo hasActiveSession", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("uses the uq_active_session_card_uid index predicate", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 });

        const result = await parkingCardsRepo.hasActiveSession("POOL-001");

        const [sql, params] = mockPoolQuery.mock.calls[0];
        expect(sql).toContain("FROM parkingsessions");
        expect(sql).toContain("WHERE card_uid = $1");
        expect(sql).toContain("time_out IS NULL");
        expect(sql).toContain("card_uid IS NOT NULL");
        expect(params).toEqual(["POOL-001"]);
        expect(result).toBe(true);
    });

    it("returns false when no active session backs the card", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });

        const result = await parkingCardsRepo.hasActiveSession("POOL-001");

        expect(result).toBe(false);
    });
});
