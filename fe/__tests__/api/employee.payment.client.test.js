import {
    createPaymentIntent,
    regeneratePaymentIntent,
    fetchPaymentStatus,
} from "@/app/api/employee.client";

jest.mock("@/app/api/client.config", () => ({
    post: jest.fn(),
    get: jest.fn(),
}));

import api from "@/app/api/client.config";

describe("employee payment client contract", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("createPaymentIntent calls create/resume endpoint", async () => {
        api.post.mockResolvedValue({ data: { data: { intent_status: "PENDING" } } });

        await createPaymentIntent(1, "idem-create", 5000);

        expect(api.post).toHaveBeenCalledWith("/employee/parking/exit/1/payment-intents", {
            payment_method: "CARD",
            idempotency_key: "idem-create",
            amount: 5000,
        });
    });

    it("regeneratePaymentIntent calls regenerate endpoint", async () => {
        api.post.mockResolvedValue({ data: { data: { intent_status: "PENDING" } } });

        await regeneratePaymentIntent(1, "idem-regen", 5000);

        expect(api.post).toHaveBeenCalledWith("/employee/parking/exit/1/payment-intents/regenerate", {
            idempotency_key: "idem-regen",
            force_new: true,
            amount: 5000,
        });
    });

    it("fetchPaymentStatus calls status endpoint", async () => {
        api.get.mockResolvedValue({ data: { data: { intent_status: "PENDING" } } });

        await fetchPaymentStatus(1);

        expect(api.get).toHaveBeenCalledWith("/employee/parking/exit/1/payment-status");
    });
});
