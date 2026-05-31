const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: {
        query: (...args) => mockPoolQuery(...args),
    },
}));

const parkingCardsRepo = require("../../repositories/parkingCards.repo");

describe("parkingCards.repo markLost", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPoolQuery.mockResolvedValue({ rows: [] });
    });

    // Validates: Requirements 11.5
    it("issues an UPDATE setting status='lost' for the given lot_id + card_uid", async () => {
        await parkingCardsRepo.markLost(1, "POOL-001");

        expect(mockPoolQuery).toHaveBeenCalledTimes(1);

        const [sql, params] = mockPoolQuery.mock.calls[0];
        expect(sql).toContain("UPDATE parking_cards");
        expect(sql).toContain("status = 'lost'");
        expect(sql).toContain("WHERE lot_id = $1 AND card_uid = $2");
        expect(params).toEqual([1, "POOL-001"]);
    });
});
