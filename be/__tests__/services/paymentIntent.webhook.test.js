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

jest.mock("../../repositories/paymentIntent.repo", () => ({
    getById: jest.fn(),
    updateIntentStatus: jest.fn(),
}));

jest.mock("../../repositories/paymentAttempt.repo", () => ({
    getByProviderOrderCode: jest.fn(),
    markPaidByOrderCode: jest.fn(),
    markFailedOrExpired: jest.fn(),
}));

jest.mock("../../repositories/paymentLedger.repo", () => ({
    insertSettledPayment: jest.fn(),
}));

jest.mock("../../services/payos.provider", () => ({
    verifyWebhook: jest.fn(),
}));

const paymentIntentService = require("../../services/paymentIntent.service");
const sessionRepo = require("../../repositories/session.repo");
const intentRepo = require("../../repositories/paymentIntent.repo");
const attemptRepo = require("../../repositories/paymentAttempt.repo");
const ledgerRepo = require("../../repositories/paymentLedger.repo");
const payosProvider = require("../../services/payos.provider");

describe("paymentIntent service webhook processing", () => {
    let dbClient;

    beforeEach(() => {
        jest.clearAllMocks();
        dbClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValue(dbClient);
    });

    it("returns replay-safe for unknown order code", async () => {
        payosProvider.verifyWebhook.mockResolvedValue({
            success: true,
            code: "00",
            data: { code: "00", orderCode: 999 },
        });
        attemptRepo.getByProviderOrderCode.mockResolvedValue(null);

        const result = await paymentIntentService.processWebhook({
            success: true,
            code: "00",
            data: { code: "00", orderCode: 999 },
        });

        expect(result).toEqual({ ok: true, replay: true, reason: "ATTEMPT_NOT_FOUND" });
    });

    it("returns replay-safe for duplicate webhook", async () => {
        payosProvider.verifyWebhook.mockResolvedValue({
            success: true,
            code: "00",
            data: { code: "00", orderCode: 123, reference: "REF" },
        });
        attemptRepo.getByProviderOrderCode.mockResolvedValue({
            attempt_id: 10,
            intent_id: 20,
            status: "PAID",
        });
        intentRepo.getById.mockResolvedValue({
            intent_id: 20,
            active_attempt_id: 10,
            status: "PAID",
        });

        const result = await paymentIntentService.processWebhook({
            success: true,
            code: "00",
            data: { code: "00", orderCode: 123, reference: "REF" },
        });

        expect(result).toEqual({ ok: true, replay: true, reason: "ALREADY_PAID" });
    });

    it("returns replay-safe when intent has no active attempt mapping", async () => {
        payosProvider.verifyWebhook.mockResolvedValue({
            success: true,
            code: "00",
            data: { code: "00", orderCode: 123, reference: "REF" },
        });
        attemptRepo.getByProviderOrderCode.mockResolvedValue({
            attempt_id: 10,
            intent_id: 20,
            status: "PENDING",
        });
        intentRepo.getById.mockResolvedValue({
            intent_id: 20,
            active_attempt_id: null,
            status: "PENDING",
        });

        const result = await paymentIntentService.processWebhook({
            success: true,
            code: "00",
            data: { code: "00", orderCode: 123, reference: "REF" },
        });

        expect(result).toEqual({ ok: true, replay: true, reason: "ATTEMPT_NOT_ACTIVE" });
    });

    it("finalizes successful active attempt exactly once", async () => {
        payosProvider.verifyWebhook.mockResolvedValue({
            success: true,
            code: "00",
            data: { code: "00", orderCode: 123, reference: "REF" },
        });
        attemptRepo.getByProviderOrderCode.mockResolvedValue({
            attempt_id: 10,
            intent_id: 20,
            status: "PENDING",
            session_id: 1,
            amount: 5000,
            sub_id: null,
        });
        intentRepo.getById.mockResolvedValue({
            intent_id: 20,
            active_attempt_id: 10,
            status: "PENDING",
        });
        attemptRepo.markPaidByOrderCode.mockResolvedValue({
            attempt_id: 10,
            intent_id: 20,
            status: "PAID",
            session_id: 1,
            amount: 5000,
            sub_id: null,
        });
        sessionRepo.getSessionForCheckout.mockResolvedValue({
            session_id: 1,
            lot_id: 2,
            vehicle_type: "car",
            is_lost: false,
        });
        sessionRepo.finalizeSessionIfOpen.mockResolvedValue({ session_id: 1, time_out: new Date().toISOString() });

        const result = await paymentIntentService.processWebhook({
            success: true,
            code: "00",
            data: { code: "00", orderCode: 123, reference: "REF" },
        });

        expect(result.ok).toBe(true);
        expect(result.replay).toBe(false);
        expect(attemptRepo.markPaidByOrderCode).toHaveBeenCalledTimes(1);
        expect(ledgerRepo.insertSettledPayment).toHaveBeenCalledTimes(1);
        expect(intentRepo.updateIntentStatus).toHaveBeenCalledWith(
            expect.objectContaining({ intentId: 20, status: "PAID" }),
            dbClient
        );
    });
});
