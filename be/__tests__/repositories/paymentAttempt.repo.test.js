const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: {
        query: (...args) => mockPoolQuery(...args),
    },
}));

const paymentAttemptRepo = require("../../repositories/paymentAttempt.repo");

describe("paymentAttempt repo intent relation contracts", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPoolQuery.mockResolvedValue({ rows: [] });
    });

    it("createAttempt accepts intentId and writes intent_id", async () => {
        await paymentAttemptRepo.createAttempt({
            sessionId: 1,
            subId: null,
            intentId: 77,
            provider: "PAYOS",
            paymentMethod: "CARD",
            amount: 12000,
        });

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("intent_id"),
            [1, null, 77, "PAYOS", "CARD", 12000]
        );
    });

    it("createAttempt supports null intentId for legacy checkout flow", async () => {
        await paymentAttemptRepo.createAttempt({
            sessionId: 1,
            subId: null,
            intentId: null,
            provider: "PAYOS",
            paymentMethod: "CARD",
            amount: 12000,
        });

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO payment_attempts"),
            [1, null, null, "PAYOS", "CARD", 12000]
        );
    });

    it("getActiveAttemptByIntentId filters active statuses", async () => {
        await paymentAttemptRepo.getActiveAttemptByIntentId(77);

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE intent_id = $1"),
            [77]
        );
        expect(mockPoolQuery.mock.calls[0][0]).toContain("status IN ('PENDING')");
    });

    it("markSupersededByIntent updates other active attempts", async () => {
        await paymentAttemptRepo.markSupersededByIntent(77, 12);

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE intent_id = $3"),
            ["EXPIRED", "Superseded by newer attempt", 77, 12]
        );
    });

    it("markPaidByOrderCode updates only pending attempts", async () => {
        await paymentAttemptRepo.markPaidByOrderCode({
            providerOrderCode: "oc_1",
            providerTransactionId: "tx_1",
            webhookPayload: { ok: true },
        });

        expect(mockPoolQuery.mock.calls[0][0]).toContain("AND status = 'PENDING'");
    });

    it("markFailedOrExpired updates only pending attempts", async () => {
        await paymentAttemptRepo.markFailedOrExpired({
            attemptId: 12,
            status: "EXPIRED",
            failureReason: "timeout",
        });

        expect(mockPoolQuery.mock.calls[0][0]).toContain("AND status = 'PENDING'");
    });
});
