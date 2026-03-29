const checkoutService = require("../../services/checkout.service");
const controller = require("../../controllers/employee.payment.controller");

jest.mock("../../services/checkout.service");

describe("employee.payment.controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("createIntent", () => {
        it("creates or resumes payment intent and returns contract shape", async () => {
            checkoutService.createIntent.mockResolvedValue({
                status: "PENDING",
                intent_status: "PENDING",
                intent: { intent_id: 12, status: "PENDING" },
                active_attempt: { attempt_id: 34, checkout_url: "https://payos/checkout/34" },
            });

            const req = {
                params: { session_id: "1" },
                body: { idempotency_key: "idem-create-1", amount: 20000 },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.createIntent(req, res);

            expect(checkoutService.createIntent).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessionId: 1,
                    paymentMethod: "CARD",
                    requestedAmount: 20000,
                    idempotencyKey: "idem-create-1",
                    forceNew: false,
                })
            );
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    intent: expect.objectContaining({ intent_id: 12 }),
                    active_attempt: expect.objectContaining({ attempt_id: 34 }),
                }),
            });
        });

        it("returns 422 when session id is missing", async () => {
            const req = {
                params: { session_id: "" },
                body: { idempotency_key: "idem-create-2" },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.createIntent(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Session ID is required",
            });
        });

        it("returns 422 when session id is not a positive integer", async () => {
            const req = {
                params: { session_id: "-1" },
                body: { idempotency_key: "idem-create-2" },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.createIntent(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Session ID is required",
            });
        });
    });

    describe("regenerateIntent", () => {
        it("returns 422 when idempotency_key is missing", async () => {
            const req = {
                params: { session_id: "1" },
                body: {},
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.regenerateIntent(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "idempotency_key is required",
            });
            expect(checkoutService.createIntent).not.toHaveBeenCalled();
        });

        it("returns 422 when idempotency_key is blank", async () => {
            const req = {
                params: { session_id: "1" },
                body: { idempotency_key: "   " },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.regenerateIntent(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "idempotency_key is required",
            });
        });

        it("forces a new attempt when idempotency_key is provided", async () => {
            checkoutService.createIntent.mockResolvedValue({
                status: "PENDING",
                intent_status: "PENDING",
                intent: { intent_id: 12, status: "PENDING" },
                active_attempt: { attempt_id: 55, checkout_url: "https://payos/checkout/55" },
            });

            const req = {
                params: { session_id: "1" },
                body: { idempotency_key: "idem-regenerate-1" },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.regenerateIntent(req, res);

            expect(checkoutService.createIntent).toHaveBeenCalledWith(
                expect.objectContaining({
                    sessionId: 1,
                    paymentMethod: "CARD",
                    idempotencyKey: "idem-regenerate-1",
                    forceNew: true,
                })
            );
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    intent: expect.objectContaining({ intent_id: 12 }),
                    active_attempt: expect.objectContaining({ attempt_id: 55 }),
                }),
            });
        });
    });

    describe("getPaymentStatus", () => {
        it("returns intent_status and active checkout fields", async () => {
            checkoutService.getPaymentStatus.mockResolvedValue({
                status: "PENDING",
                intent_status: "PENDING",
                checkout_url: "https://payos/checkout/77",
                qr_code_url: "qr_77",
                intent: { intent_id: 12, status: "PENDING" },
                active_attempt: { attempt_id: 77, status: "PENDING" },
            });

            const req = {
                params: { session_id: "1" },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.getPaymentStatus(req, res);

            expect(checkoutService.getPaymentStatus).toHaveBeenCalledWith({ sessionId: 1 });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    intent_status: "PENDING",
                    checkout_url: "https://payos/checkout/77",
                    intent: expect.objectContaining({ intent_id: 12 }),
                    active_attempt: expect.objectContaining({ attempt_id: 77 }),
                }),
            });
        });
    });
});
