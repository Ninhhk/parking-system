/**
 * Unit tests — subscription lookup controller (getByCard)
 *
 * Covers the kiosk subscriber tap-and-go lookup endpoint
 * (GET /api/employee/subscription/by-card/:card_uid):
 *   - 200 with the active subscription shape
 *   - 404 when no active subscription exists
 *   - 422 when card_uid is missing/blank
 *   - 500 when the service/DB query fails
 *
 * Validates: Requirements 5.1, 5.4
 */

const controller = require("../../controllers/employee.subscription.controller");
const service = require("../../services/employee.subscription.service");

jest.mock("../../services/employee.subscription.service");

describe("employee.subscription.controller — getByCard", () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
    });

    describe("success (200)", () => {
        it("returns 200 with the active subscription in the documented shape", async () => {
            const subscription = {
                sub_id: 42,
                vehicle_type: "car",
                owner_name: "Nguyen Van A",
                start_date: "2025-01-01",
                end_date: "2099-12-31",
            };
            service.getActiveSubscriptionByCard.mockResolvedValue(subscription);

            req.params = { card_uid: "CARD-001" };

            await controller.getByCard(req, res);

            expect(service.getActiveSubscriptionByCard).toHaveBeenCalledWith("CARD-001");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: subscription,
            });

            // Response carries exactly the fields the kiosk relies on.
            const payload = res.json.mock.calls[0][0];
            expect(Object.keys(payload.data).sort()).toEqual(
                ["end_date", "owner_name", "start_date", "sub_id", "vehicle_type"]
            );
        });
    });

    describe("not found (404)", () => {
        it("returns 404 when no active subscription exists for the card", async () => {
            service.getActiveSubscriptionByCard.mockResolvedValue(null);

            req.params = { card_uid: "UNKNOWN-CARD" };

            await controller.getByCard(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("No active subscription"),
            });
        });
    });

    describe("invalid input (422)", () => {
        it("returns 422 when card_uid is missing", async () => {
            req.params = {};

            await controller.getByCard(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("card_uid"),
            });
            expect(service.getActiveSubscriptionByCard).not.toHaveBeenCalled();
        });

        it("returns 422 when card_uid is whitespace-only", async () => {
            req.params = { card_uid: "   " };

            await controller.getByCard(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(service.getActiveSubscriptionByCard).not.toHaveBeenCalled();
        });
    });

    describe("system error (500)", () => {
        it("returns 500 when the lookup fails due to a DB/system error", async () => {
            service.getActiveSubscriptionByCard.mockRejectedValue(new Error("db down"));

            req.params = { card_uid: "CARD-001" };

            await controller.getByCard(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("Internal server error"),
            });
        });
    });
});
