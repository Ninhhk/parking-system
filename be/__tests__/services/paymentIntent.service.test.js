const mockConnect = jest.fn();

jest.mock("../../config/db", () => ({
    pool: {
        connect: () => mockConnect(),
    },
}));

jest.mock("../../repositories/session.repo", () => ({
    getSessionForCheckout: jest.fn(),
    getSessionForCheckoutForUpdate: jest.fn(),
}));

jest.mock("../../repositories/paymentIntent.repo", () => ({
    getActiveBySessionForUpdate: jest.fn(),
    createIntent: jest.fn(),
    setActiveAttempt: jest.fn(),
    updateIntentStatus: jest.fn(),
    getById: jest.fn(),
}));

jest.mock("../../repositories/paymentAttempt.repo", () => ({
    getActiveAttemptByIntentId: jest.fn(),
    createAttempt: jest.fn(),
    attachProviderIntent: jest.fn(),
    markSupersededByIntent: jest.fn(),
    markFailedOrExpired: jest.fn(),
    getById: jest.fn(),
}));

jest.mock("../../services/payos.provider", () => ({
    createPaymentLink: jest.fn(),
    verifyWebhook: jest.fn(),
}));

jest.mock("../../services/feeCalculation.service", () => ({
    calculateAndValidateFee: jest.fn(),
}));

const paymentIntentService = require("../../services/paymentIntent.service");
const sessionRepo = require("../../repositories/session.repo");
const intentRepo = require("../../repositories/paymentIntent.repo");
const attemptRepo = require("../../repositories/paymentAttempt.repo");
const payosProvider = require("../../services/payos.provider");
const feeService = require("../../services/feeCalculation.service");

describe("paymentIntent service", () => {
    let dbClient;

    beforeEach(() => {
        jest.clearAllMocks();
        dbClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValue(dbClient);
        feeService.calculateAndValidateFee.mockReturnValue({
            success: true,
            totalAmount: 20000,
            serviceFee: 20000,
            penaltyFee: 0,
            hours: 1,
        });
        sessionRepo.getSessionForCheckout.mockResolvedValue({
            session_id: 1,
            time_out: null,
            time_in: "2026-03-28T10:00:00.000Z",
            service_fee: 20000,
            penalty_fee: 50000,
            is_monthly: false,
            is_lost: false,
        });
        sessionRepo.getSessionForCheckoutForUpdate.mockResolvedValue({
            session_id: 1,
            time_out: null,
            time_in: "2026-03-28T10:00:00.000Z",
            service_fee: 20000,
            penalty_fee: 50000,
            is_monthly: false,
            is_lost: false,
        });
    });

    it("reuses active intent and attempt when forceNew is false", async () => {
        intentRepo.getActiveBySessionForUpdate.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            active_attempt_id: 21,
            amount: 20000,
        });
        attemptRepo.getById.mockResolvedValue({
            attempt_id: 21,
            intent_id: 10,
            status: "PENDING",
            provider_order_code: "oc_21",
            checkout_url: "https://payos/checkout/21",
            qr_code_url: "qr_21",
            expires_at: "2099-03-29T12:00:00.000Z",
        });

        const result = await paymentIntentService.createOrReuseIntent({
            sessionId: 1,
            paymentMethod: "CARD",
            forceNew: false,
        });

        expect(result.reused).toBe(true);
        expect(result.intent.intent_id).toBe(10);
        expect(result.active_attempt.attempt_id).toBe(21);
        expect(attemptRepo.createAttempt).not.toHaveBeenCalled();
        expect(payosProvider.createPaymentLink).not.toHaveBeenCalled();
        expect(dbClient.query).toHaveBeenCalledWith("BEGIN");
        expect(dbClient.query).toHaveBeenCalledWith("COMMIT");
        expect(sessionRepo.getSessionForCheckoutForUpdate).toHaveBeenCalledWith(1, dbClient);
    });

    it("regenerate creates fresh attempt with idempotency key and supersedes older pending attempts", async () => {
        const writeClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValueOnce(dbClient).mockReturnValueOnce(writeClient);

        intentRepo.getActiveBySessionForUpdate.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            provider: "PAYOS",
        });

        attemptRepo.createAttempt.mockResolvedValue({
            attempt_id: 22,
            intent_id: 10,
            status: "PENDING",
        });

        payosProvider.createPaymentLink.mockResolvedValue({
            orderCode: 123456,
            checkoutUrl: "https://payos/checkout/22",
            qrCode: "qr_22",
            expiredAt: "2099-03-29T13:00:00.000Z",
        });

        attemptRepo.attachProviderIntent.mockResolvedValue({
            attempt_id: 22,
            intent_id: 10,
            status: "PENDING",
            provider_order_code: "123456",
            checkout_url: "https://payos/checkout/22",
            qr_code_url: "qr_22",
            expires_at: "2099-03-29T13:00:00.000Z",
        });

        intentRepo.setActiveAttempt.mockResolvedValue({
            intent_id: 10,
            active_attempt_id: 22,
            status: "PENDING",
        });

        intentRepo.updateIntentStatus.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            active_attempt_id: 22,
            provider: "PAYOS",
        });

        attemptRepo.markSupersededByIntent.mockResolvedValue([{ attempt_id: 21, status: "EXPIRED" }]);

        const result = await paymentIntentService.createOrReuseIntent({
            sessionId: 1,
            paymentMethod: "CARD",
            forceNew: true,
        });

        expect(result.reused).toBe(false);
        expect(result.intent.intent_id).toBe(10);
        expect(result.active_attempt.attempt_id).toBe(22);
        expect(attemptRepo.createAttempt).toHaveBeenCalledWith(
            expect.objectContaining({ intentId: 10, sessionId: 1, paymentMethod: "CARD" }),
            dbClient
        );
        expect(payosProvider.createPaymentLink).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 20000,
                description: "Checkout 1",
            }),
            expect.objectContaining({
                idempotencyKey: "pi-10-attempt-22",
            })
        );
        expect(attemptRepo.markSupersededByIntent).toHaveBeenCalledWith(10, 22, writeClient);
        expect(dbClient.query).toHaveBeenCalledWith("COMMIT");
        expect(writeClient.query).toHaveBeenCalledWith("COMMIT");
        expect(intentRepo.updateIntentStatus).toHaveBeenCalledWith(
            expect.objectContaining({
                intentId: 10,
                amount: 20000,
            }),
            writeClient
        );
    });

    it("getPaymentStatus returns intent and active attempt projection", async () => {
        intentRepo.getById.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            active_attempt_id: 22,
            provider: "PAYOS",
        });

        attemptRepo.getById.mockResolvedValue({
            attempt_id: 22,
            intent_id: 10,
            status: "PENDING",
            provider_order_code: "123456",
            checkout_url: "https://payos/checkout/22",
            qr_code_url: "qr_22",
            expires_at: "2099-03-29T13:00:00.000Z",
        });

        const result = await paymentIntentService.getPaymentStatus({ intentId: 10 });

        expect(result).toEqual({
            intent: {
                intent_id: 10,
                session_id: 1,
                status: "PENDING",
                amount: 20000,
                active_attempt_id: 22,
                provider: "PAYOS",
            },
            active_attempt: {
                attempt_id: 22,
                status: "PENDING",
                provider_order_code: "123456",
                checkout_url: "https://payos/checkout/22",
                qr_code_url: "qr_22",
                expires_at: "2099-03-29T13:00:00.000Z",
            },
        });
    });

    it("does not reuse pending attempt without checkout_url/provider_order_code", async () => {
        const writeClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValueOnce(dbClient).mockReturnValueOnce(writeClient);

        intentRepo.getActiveBySessionForUpdate.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            active_attempt_id: 21,
            amount: 20000,
            provider: "PAYOS",
        });
        attemptRepo.getById.mockResolvedValue({
            attempt_id: 21,
            intent_id: 10,
            status: "PENDING",
            amount: 20000,
            provider_order_code: null,
            checkout_url: null,
            qr_code_url: null,
            expires_at: null,
        });

        attemptRepo.createAttempt.mockResolvedValue({
            attempt_id: 22,
            intent_id: 10,
            status: "PENDING",
        });

        payosProvider.createPaymentLink.mockResolvedValue({
            orderCode: 22,
            checkoutUrl: "https://payos/checkout/22",
            qrCode: "qr_22",
            expiredAt: "2099-03-29T13:00:00.000Z",
        });

        attemptRepo.attachProviderIntent.mockResolvedValue({
            attempt_id: 22,
            intent_id: 10,
            status: "PENDING",
            provider_order_code: "22",
            checkout_url: "https://payos/checkout/22",
            qr_code_url: "qr_22",
            expires_at: "2099-03-29T13:00:00.000Z",
        });

        intentRepo.setActiveAttempt.mockResolvedValue({
            intent_id: 10,
            active_attempt_id: 22,
            status: "PENDING",
            amount: 20000,
            provider: "PAYOS",
        });

        intentRepo.updateIntentStatus.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            active_attempt_id: 22,
            provider: "PAYOS",
        });

        const result = await paymentIntentService.createOrReuseIntent({
            sessionId: 1,
            paymentMethod: "CARD",
            forceNew: false,
        });

        expect(result.reused).toBe(false);
        expect(attemptRepo.createAttempt).toHaveBeenCalled();
    });

    it("does not reuse expired or amount-mismatched pending attempt", async () => {
        const writeClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValueOnce(dbClient).mockReturnValueOnce(writeClient);

        intentRepo.getActiveBySessionForUpdate.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            active_attempt_id: 21,
            amount: 20000,
            provider: "PAYOS",
        });

        attemptRepo.getById.mockResolvedValue({
            attempt_id: 21,
            intent_id: 10,
            status: "PENDING",
            amount: 10000,
            provider_order_code: "21",
            checkout_url: "https://payos/checkout/21",
            qr_code_url: "qr_21",
            expires_at: "2000-01-01T00:00:00.000Z",
        });

        attemptRepo.createAttempt.mockResolvedValue({
            attempt_id: 24,
            intent_id: 10,
            status: "PENDING",
        });

        payosProvider.createPaymentLink.mockResolvedValue({
            orderCode: 24,
            checkoutUrl: "https://payos/checkout/24",
            qrCode: "qr_24",
            expiredAt: "2099-03-29T13:00:00.000Z",
        });

        attemptRepo.attachProviderIntent.mockResolvedValue({
            attempt_id: 24,
            intent_id: 10,
            status: "PENDING",
            provider_order_code: "24",
            checkout_url: "https://payos/checkout/24",
            qr_code_url: "qr_24",
            expires_at: "2099-03-29T13:00:00.000Z",
        });

        intentRepo.setActiveAttempt.mockResolvedValue({
            intent_id: 10,
            active_attempt_id: 24,
            status: "PENDING",
            amount: 20000,
            provider: "PAYOS",
        });

        intentRepo.updateIntentStatus.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            active_attempt_id: 24,
            provider: "PAYOS",
        });

        const result = await paymentIntentService.createOrReuseIntent({
            sessionId: 1,
            paymentMethod: "CARD",
            forceNew: false,
        });

        expect(result.reused).toBe(false);
        expect(attemptRepo.createAttempt).toHaveBeenCalled();
    });

    it("does not reuse pending attempt when expires_at is null", async () => {
        const writeClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValueOnce(dbClient).mockReturnValueOnce(writeClient);

        intentRepo.getActiveBySessionForUpdate.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            active_attempt_id: 21,
            amount: 20000,
            provider: "PAYOS",
        });

        attemptRepo.getById.mockResolvedValue({
            attempt_id: 21,
            intent_id: 10,
            status: "PENDING",
            amount: 20000,
            provider_order_code: "21",
            checkout_url: "https://payos/checkout/21",
            qr_code_url: "qr_21",
            expires_at: null,
        });

        attemptRepo.createAttempt.mockResolvedValue({
            attempt_id: 24,
            intent_id: 10,
            status: "PENDING",
        });

        payosProvider.createPaymentLink.mockResolvedValue({
            orderCode: 24,
            checkoutUrl: "https://payos/checkout/24",
            qrCode: "qr_24",
            expiredAt: "2099-03-29T13:00:00.000Z",
        });

        attemptRepo.attachProviderIntent.mockResolvedValue({
            attempt_id: 24,
            intent_id: 10,
            status: "PENDING",
            provider_order_code: "24",
            checkout_url: "https://payos/checkout/24",
            qr_code_url: "qr_24",
            expires_at: "2099-03-29T13:00:00.000Z",
        });

        intentRepo.setActiveAttempt.mockResolvedValue({
            intent_id: 10,
            active_attempt_id: 24,
            status: "PENDING",
            amount: 20000,
            provider: "PAYOS",
        });

        intentRepo.updateIntentStatus.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            active_attempt_id: 24,
            provider: "PAYOS",
        });

        const result = await paymentIntentService.createOrReuseIntent({
            sessionId: 1,
            paymentMethod: "CARD",
            forceNew: false,
        });

        expect(result.reused).toBe(false);
        expect(attemptRepo.createAttempt).toHaveBeenCalled();
    });

    it("passes expiredAt to provider and stores fallback expiry when provider omits it", async () => {
        const writeClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValueOnce(dbClient).mockReturnValueOnce(writeClient);

        intentRepo.getActiveBySessionForUpdate.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            provider: "PAYOS",
        });

        attemptRepo.createAttempt.mockResolvedValue({
            attempt_id: 25,
            intent_id: 10,
            status: "PENDING",
        });

        payosProvider.createPaymentLink.mockResolvedValue({
            orderCode: 25,
            checkoutUrl: "https://payos/checkout/25",
            qrCode: "qr_25",
        });

        attemptRepo.attachProviderIntent.mockResolvedValue({
            attempt_id: 25,
            intent_id: 10,
            status: "PENDING",
            provider_order_code: "25",
            checkout_url: "https://payos/checkout/25",
            qr_code_url: "qr_25",
            expires_at: "2099-03-29T13:00:00.000Z",
        });

        intentRepo.setActiveAttempt.mockResolvedValue({
            intent_id: 10,
            active_attempt_id: 25,
            status: "PENDING",
            amount: 20000,
            provider: "PAYOS",
        });

        intentRepo.updateIntentStatus.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            active_attempt_id: 25,
            provider: "PAYOS",
        });

        await paymentIntentService.createOrReuseIntent({
            sessionId: 1,
            paymentMethod: "CARD",
            forceNew: true,
        });

        expect(payosProvider.createPaymentLink).toHaveBeenCalledWith(
            expect.objectContaining({
                expiredAt: expect.any(Number),
            }),
            expect.any(Object)
        );
        expect(attemptRepo.attachProviderIntent).toHaveBeenCalledWith(
            expect.objectContaining({
                attemptId: 25,
                expiresAt: expect.anything(),
            }),
            writeClient
        );
    });

    it("marks attempt failed and intent requires payment method when provider link creation fails", async () => {
        const failClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect
            .mockReturnValueOnce(dbClient)
            .mockReturnValueOnce(failClient);

        intentRepo.getActiveBySessionForUpdate.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            provider: "PAYOS",
        });

        attemptRepo.createAttempt.mockResolvedValue({
            attempt_id: 23,
            intent_id: 10,
            status: "PENDING",
        });

        payosProvider.createPaymentLink.mockRejectedValue(new Error("network down"));

        await expect(
            paymentIntentService.createOrReuseIntent({
                sessionId: 1,
                paymentMethod: "CARD",
                forceNew: true,
            })
        ).rejects.toThrow("network down");

        expect(attemptRepo.markFailedOrExpired).toHaveBeenCalledWith(
            expect.objectContaining({ attemptId: 23, status: "FAILED" }),
            failClient
        );
        expect(intentRepo.updateIntentStatus).toHaveBeenCalledWith(
            expect.objectContaining({ intentId: 10, status: "REQUIRES_PAYMENT_METHOD" }),
            failClient
        );
    });

    it("compensates when provider link persistence transaction fails", async () => {
        const writeClient = {
            query: jest
                .fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockRejectedValueOnce(new Error("db write failed")),
            release: jest.fn(),
        };
        const failClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };

        mockConnect
            .mockReturnValueOnce(dbClient)
            .mockReturnValueOnce(writeClient)
            .mockReturnValueOnce(failClient);

        intentRepo.getActiveBySessionForUpdate.mockResolvedValue({
            intent_id: 10,
            session_id: 1,
            status: "PENDING",
            amount: 20000,
            provider: "PAYOS",
        });

        attemptRepo.createAttempt.mockResolvedValue({
            attempt_id: 25,
            intent_id: 10,
            status: "PENDING",
        });

        payosProvider.createPaymentLink.mockResolvedValue({
            orderCode: 25,
            checkoutUrl: "https://payos/checkout/25",
            qrCode: "qr_25",
            expiredAt: "2099-03-29T13:00:00.000Z",
        });

        await expect(
            paymentIntentService.createOrReuseIntent({
                sessionId: 1,
                paymentMethod: "CARD",
                forceNew: true,
            })
        ).rejects.toThrow("db write failed");

        expect(attemptRepo.markFailedOrExpired).toHaveBeenCalledWith(
            expect.objectContaining({ attemptId: 25, status: "FAILED" }),
            failClient
        );
        expect(intentRepo.updateIntentStatus).toHaveBeenCalledWith(
            expect.objectContaining({ intentId: 10, status: "REQUIRES_PAYMENT_METHOD" }),
            failClient
        );
    });
});
