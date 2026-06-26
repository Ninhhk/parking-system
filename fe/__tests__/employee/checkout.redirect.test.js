import { redirect } from "next/navigation";

import CheckoutSessionRedirect from "@/app/employee/checkout/[sessionid]/page";

jest.mock("next/navigation", () => ({
    redirect: jest.fn(),
}));

describe("legacy checkout session route redirect", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Validates: Requirements R8 — old /employee/checkout/[sessionid] deep links
    // redirect to the unified single-screen terminal at /employee/checkout.
    it("redirects /employee/checkout/[sessionid] to /employee/checkout", () => {
        CheckoutSessionRedirect();

        expect(redirect).toHaveBeenCalledTimes(1);
        expect(redirect).toHaveBeenCalledWith("/employee/checkout");
    });
});
