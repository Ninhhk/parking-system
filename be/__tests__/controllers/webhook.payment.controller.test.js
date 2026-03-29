const checkoutService = require("../../services/checkout.service");
const controller = require("../../controllers/webhook.payment.controller");

jest.mock("../../services/checkout.service");

describe("webhook.payment.controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("returns 200 for valid webhook payload", async () => {
        checkoutService.finalizeFromWebhook.mockResolvedValue({ ok: true, replay: false, reason: null });

        const req = {
            body: { code: "00", success: true, data: { orderCode: 123 }, signature: "sig" },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        await controller.payosWebhook(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { ok: true, replay: false, reason: null },
        });
    });

    it("returns 200 replay-safe payload when webhook verification fails", async () => {
        checkoutService.finalizeFromWebhook.mockRejectedValue(new Error("signature invalid"));

        const req = {
            body: { code: "00", success: true, data: { orderCode: 123 }, signature: "sig" },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };

        await controller.payosWebhook(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { ok: true, replay: true, reason: "INVALID_WEBHOOK" },
        });
    });
});
