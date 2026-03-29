const mockConnect = jest.fn();

jest.mock("../../config/db", () => ({
    pool: {
        connect: () => mockConnect(),
    },
}));

jest.mock("../../repositories/session.repo", () => ({
    getSessionForCheckout: jest.fn(),
    finalizeSessionIfOpen: jest.fn(),
    decrementLotCountAtomic: jest.fn(),
}));

jest.mock("../../repositories/paymentAttempt.repo", () => ({
    createAttempt: jest.fn(),
    attachProviderIntent: jest.fn(),
    getLatestBySession: jest.fn(),
    getByProviderOrderCode: jest.fn(),
    markPaidByOrderCode: jest.fn(),
    markFailedOrExpired: jest.fn(),
}));

jest.mock("../../repositories/paymentLedger.repo", () => ({
    insertSettledPayment: jest.fn(),
}));

jest.mock("../../services/payos.client", () => ({
    createPaymentLink: jest.fn(),
    verifyWebhook: jest.fn(),
}));

jest.mock("../../services/feeCalculation.service", () => ({
    calculateAndValidateFee: jest.fn(),
}));

jest.mock("../../services/paymentIntent.service", () => ({
    createOrReuseIntent: jest.fn(),
    getPaymentStatus: jest.fn(),
    processWebhook: jest.fn(),
}));

const checkoutService = require("../../services/checkout.service");
const sessionRepo = require("../../repositories/session.repo");
const attemptRepo = require("../../repositories/paymentAttempt.repo");
const ledgerRepo = require("../../repositories/paymentLedger.repo");
const payosClient = require("../../services/payos.client");
const feeCalculationService = require("../../services/feeCalculation.service");
const paymentIntentService = require("../../services/paymentIntent.service");

describe("checkout service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnect.mockReturnValue({
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        });
    });

    it("createIntent creates pending attempt and returns qr payload", async () => {
        paymentIntentService.createOrReuseIntent.mockResolvedValue({
            reused: false,
            intent: { intent_id: 99, status: "PENDING" },
            active_attempt: {
                attempt_id: 10,
                provider_order_code: "123456",
                qr_code_url: "qr",
                checkout_url: "https://payos/checkout",
                expires_at: "2026-03-28T12:00:00Z",
                status: "PENDING",
            },
            amount: 20000,
            service_fee: 20000,
            penalty_fee: 0,
            hours: 1,
        });

        const result = await checkoutService.createIntent({
            sessionId: 1,
            paymentMethod: "CARD",
        });
        expect(result.status).toBe("PENDING");
        expect(result.checkout_url).toContain("payos/checkout");
        expect(result.amount).toBe(20000);
        expect(result.service_fee).toBe(20000);
        expect(result.penalty_fee).toBe(0);
        expect(result.hours).toBe(1);
        expect(paymentIntentService.createOrReuseIntent).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: 1,
                paymentMethod: "CARD",
            })
        );
    });

    it("createIntent rejects tampered requested amount", async () => {
        paymentIntentService.createOrReuseIntent.mockRejectedValue(
            new Error("Requested amount does not match server-calculated amount")
        );

        await expect(
            checkoutService.createIntent({
                sessionId: 1,
                paymentMethod: "CARD",
                requestedAmount: 1000,
            })
        ).rejects.toThrow("Requested amount does not match server-calculated amount");
    });

    it("confirmCashCheckout rejects non-cash method", async () => {
        await expect(
            checkoutService.confirmCashCheckout({ sessionId: 1, totalAmount: 1000, paymentMethod: "CARD" })
        ).rejects.toThrow("CARD must be finalized by webhook");
    });

    it("finalizeFromWebhook finalizes and replays safely", async () => {
        paymentIntentService.processWebhook
            .mockResolvedValueOnce({ ok: true, replay: false })
            .mockResolvedValueOnce({ ok: true, replay: true });

        const first = await checkoutService.finalizeFromWebhook({
            code: "00",
            success: true,
            data: { orderCode: 123, code: "00" },
        });
        const second = await checkoutService.finalizeFromWebhook({
            code: "00",
            success: true,
            data: { orderCode: 123, code: "00" },
        });

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        expect(paymentIntentService.processWebhook).toHaveBeenCalledTimes(2);
    });
});
