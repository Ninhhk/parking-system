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

    it("createAttempt accepts intentId and writes intent_id with CREATED status", async () => {
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
        expect(mockPoolQuery.mock.calls[0][0]).toContain("'CREATED'");
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

    it("attachProviderIntent transitions status to PENDING", async () => {
        await paymentAttemptRepo.attachProviderIntent({
            attemptId: 5,
            providerOrderCode: "oc_1",
            qrCodeUrl: "https://qr.example.com",
            checkoutUrl: "https://checkout.example.com",
            expiresAt: "2024-01-15T10:30:00Z",
        });

        expect(mockPoolQuery.mock.calls[0][0]).toContain("status = 'PENDING'");
        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE attempt_id = $5"),
            ["oc_1", "https://qr.example.com", "https://checkout.example.com", "2024-01-15T10:30:00Z", 5]
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

    it("markSupersededByIntent sets SUPERSEDED for PENDING/CREATED attempts except given one", async () => {
        await paymentAttemptRepo.markSupersededByIntent(77, 12);

        const sql = mockPoolQuery.mock.calls[0][0];
        expect(sql).toContain("status = 'SUPERSEDED'");
        expect(sql).toContain("intent_id = $1");
        expect(sql).toContain("attempt_id != $2");
        expect(sql).toContain("('PENDING', 'CREATED')");
        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.any(String),
            [77, 12]
        );
    });

    it("markPaidByOrderCode updates only pending attempts (CAS guard)", async () => {
        await paymentAttemptRepo.markPaidByOrderCode({
            providerOrderCode: "oc_1",
            providerTransactionId: "tx_1",
            webhookPayload: { ok: true },
        });

        expect(mockPoolQuery.mock.calls[0][0]).toContain("AND status = 'PENDING'");
    });

    it("markFailedOrExpired updates PENDING or CREATED attempts", async () => {
        await paymentAttemptRepo.markFailedOrExpired({
            attemptId: 12,
            status: "EXPIRED",
            failureReason: "timeout",
        });

        expect(mockPoolQuery.mock.calls[0][0]).toContain("AND status IN ('PENDING', 'CREATED')");
    });

    it("getByProviderOrderCode queries by provider_order_code", async () => {
        await paymentAttemptRepo.getByProviderOrderCode("oc_42");

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE provider_order_code = $1"),
            ["oc_42"]
        );
    });

    it("getById queries by attempt_id", async () => {
        await paymentAttemptRepo.getById(99);

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE attempt_id = $1"),
            [99]
        );
    });
});
