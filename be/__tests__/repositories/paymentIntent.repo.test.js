const mockPoolQuery = jest.fn();

jest.mock("../../config/db", () => ({
    pool: {
        query: (...args) => mockPoolQuery(...args),
    },
}));

const paymentIntentRepo = require("../../repositories/paymentIntent.repo");

describe("paymentIntent repo query contracts", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPoolQuery.mockResolvedValue({ rows: [] });
    });

    it("getActiveBySessionForUpdate locks active intent row", async () => {
        const client = { query: jest.fn().mockResolvedValue({ rows: [{ intent_id: 1 }] }) };

        await paymentIntentRepo.getActiveBySessionForUpdate(10, client);

        expect(client.query).toHaveBeenCalledWith(
            expect.stringContaining("FOR UPDATE"),
            [10]
        );
        expect(client.query.mock.calls[0][0]).toContain("status IN ('REQUIRES_PAYMENT_METHOD', 'PENDING')");
    });

    it("createIntent writes payment_intents row", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [{ intent_id: 5 }] });

        await paymentIntentRepo.createIntent({
            sessionId: 11,
            provider: "PAYOS",
            status: "PENDING",
            amount: 20000,
            providerIntentId: "pi_1",
            providerOrderCode: "oc_1",
            checkoutUrl: "https://checkout",
            expiresAt: "2026-03-29T10:00:00Z",
            metadata: { hello: "world" },
        });

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO payment_intents"),
            [
                11,
                "PAYOS",
                "PENDING",
                20000,
                "pi_1",
                "oc_1",
                "https://checkout",
                "2026-03-29T10:00:00Z",
                JSON.stringify({ hello: "world" }),
            ]
        );
    });

    it("setActiveAttempt stores active attempt in metadata", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [{ intent_id: 7 }] });

        await paymentIntentRepo.setActiveAttempt(7, 99);

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("active_attempt_id"),
            [7, 99]
        );
    });

    it("updateIntentStatus updates status and optional fields", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [{ intent_id: 7, status: "PAID" }] });

        await paymentIntentRepo.updateIntentStatus({
            intentId: 7,
            status: "PAID",
            providerIntentId: "pi_1",
            providerOrderCode: "oc_1",
            checkoutUrl: "https://checkout",
            expiresAt: "2026-03-29T10:00:00Z",
            metadata: { foo: "bar" },
        });

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE payment_intents"),
            ["PAID", null, "pi_1", "oc_1", "https://checkout", "2026-03-29T10:00:00Z", JSON.stringify({ foo: "bar" }), 7]
        );
    });

    it("getById selects one intent", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [{ intent_id: 8 }] });

        await paymentIntentRepo.getById(8);

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE intent_id = $1"),
            [8]
        );
    });

    it("getBySession returns intents ordered by newest", async () => {
        mockPoolQuery.mockResolvedValue({ rows: [{ intent_id: 9 }] });

        await paymentIntentRepo.getBySession(4);

        expect(mockPoolQuery).toHaveBeenCalledWith(
            expect.stringContaining("WHERE session_id = $1"),
            [4]
        );
    });
});
