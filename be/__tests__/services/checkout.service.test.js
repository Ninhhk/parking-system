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

const checkoutService = require("../../services/checkout.service");
const sessionRepo = require("../../repositories/session.repo");
const attemptRepo = require("../../repositories/paymentAttempt.repo");
const ledgerRepo = require("../../repositories/paymentLedger.repo");
const payosClient = require("../../services/payos.client");

describe("checkout service", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockConnect.mockReturnValue({
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        });
    });

    it("createIntent creates pending attempt and returns qr payload", async () => {
        sessionRepo.getSessionForCheckout.mockResolvedValue({
            session_id: 1,
            time_out: null,
            time_in: "2026-03-28T10:00:00.000Z",
            service_fee: 20000,
            penalty_fee: 50000,
            is_monthly: false,
            is_lost: false,
        });
        attemptRepo.createAttempt.mockResolvedValue({ attempt_id: 10 });
        attemptRepo.attachProviderIntent.mockResolvedValue({
            attempt_id: 10,
            provider_order_code: "123456",
            qr_code_url: "qr",
            checkout_url: "https://payos/checkout",
            expires_at: "2026-03-28T12:00:00Z",
            status: "PENDING",
        });
        payosClient.createPaymentLink.mockResolvedValue({
            orderCode: 123456,
            checkoutUrl: "https://payos/checkout",
            qrCode: "qr",
            expiredAt: "2026-03-28T12:00:00Z",
        });

        const result = await checkoutService.createIntent({
            sessionId: 1,
            paymentMethod: "CARD",
        });
        expect(result.status).toBe("PENDING");
        expect(result.checkout_url).toContain("payos/checkout");
        expect(attemptRepo.createAttempt).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: 1,
                paymentMethod: "CARD",
                amount: expect.any(Number),
            })
        );
    });

    it("createIntent rejects tampered requested amount", async () => {
        sessionRepo.getSessionForCheckout.mockResolvedValue({
            session_id: 1,
            time_out: null,
            time_in: "2026-03-28T10:00:00.000Z",
            service_fee: 20000,
            penalty_fee: 50000,
            is_monthly: false,
            is_lost: false,
        });

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
        const dbClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValue(dbClient);

        payosClient.verifyWebhook.mockReturnValue({ data: { orderCode: 123, reference: "REF123" } });

        attemptRepo.getByProviderOrderCode
            .mockResolvedValueOnce({
                attempt_id: 20,
                session_id: 1,
                sub_id: null,
                amount: 5000,
                status: "PENDING",
            })
            .mockResolvedValueOnce({
                attempt_id: 20,
                session_id: 1,
                sub_id: null,
                amount: 5000,
                status: "PAID",
            });

        attemptRepo.markPaidByOrderCode.mockResolvedValue({
            attempt_id: 20,
            session_id: 1,
            sub_id: null,
            amount: 5000,
            status: "PAID",
        });

        sessionRepo.getSessionForCheckout.mockResolvedValue({ session_id: 1, lot_id: 2, vehicle_type: "car", is_lost: false });
        sessionRepo.finalizeSessionIfOpen.mockResolvedValue({ session_id: 1, time_out: new Date().toISOString() });
        ledgerRepo.insertSettledPayment.mockResolvedValue({ payment_id: 99 });

        const first = await checkoutService.finalizeFromWebhook({ code: "00", success: true, data: { orderCode: 123 } });
        const second = await checkoutService.finalizeFromWebhook({ code: "00", success: true, data: { orderCode: 123 } });

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
    });
});
