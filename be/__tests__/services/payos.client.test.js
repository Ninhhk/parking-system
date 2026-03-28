jest.mock("@payos/node", () => {
    const create = jest.fn().mockResolvedValue({ checkoutUrl: "https://pay" });
    const verify = jest.fn().mockReturnValue({ data: { orderCode: 123 } });

    return {
        PayOS: jest.fn().mockImplementation(() => ({
            paymentRequests: { create },
            webhooks: { verify },
        })),
    };
});

const payosClient = require("../../services/payos.client");

describe("payos client", () => {
    it("createPaymentLink returns checkout payload", async () => {
        const result = await payosClient.createPaymentLink({
            orderCode: 123,
            amount: 12000,
            description: "Checkout #123",
            returnUrl: "http://localhost:3000/employee/checkout/1",
            cancelUrl: "http://localhost:3000/employee/checkout/1",
        });

        expect(result.checkoutUrl).toBe("https://pay");
    });

    it("verifyWebhook delegates to sdk verify", () => {
        const parsed = payosClient.verifyWebhook({ data: { orderCode: 123 }, signature: "sig" });
        expect(parsed.data.orderCode).toBe(123);
    });
});
