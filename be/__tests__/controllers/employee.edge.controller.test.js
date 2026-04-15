const edgeCheckinService = require("../../services/edge.checkin.service");
const controller = require("../../controllers/employee.edge.controller");

jest.mock("../../services/edge.checkin.service");

describe("employee.edge.controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("ingestCheckinEvent", () => {
        it("returns 422 when gateway_id is missing", async () => {
            const req = {
                body: {
                    lane_id: "L1",
                    trigger_type: "IC_CARD",
                    vehicle_type: "CAR",
                    lot_id: 1,
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.ingestCheckinEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "gateway_id is required",
            });
            expect(edgeCheckinService.ingestCheckinEvent).not.toHaveBeenCalled();
        });

        it("returns 422 when lane_id is missing", async () => {
            const req = {
                body: {
                    gateway_id: "GW-1",
                    trigger_type: "IC_CARD",
                    vehicle_type: "CAR",
                    lot_id: 1,
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.ingestCheckinEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "lane_id is required",
            });
            expect(edgeCheckinService.ingestCheckinEvent).not.toHaveBeenCalled();
        });

        it("returns 409 when service resolves null session", async () => {
            edgeCheckinService.ingestCheckinEvent.mockResolvedValue(null);

            const req = {
                body: {
                    gateway_id: "GW-1",
                    lane_id: "L1",
                    trigger_type: "IC_CARD",
                    vehicle_type: "CAR",
                    lot_id: 1,
                    card_uid: "CARD-001",
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.ingestCheckinEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Parking lot is full for this vehicle type",
            });
        });

        it("returns 201 for valid IC_CARD payload", async () => {
            const session = {
                session_id: 10,
                entry_lane_id: "L1",
                card_uid: "CARD-001",
            };
            edgeCheckinService.ingestCheckinEvent.mockResolvedValue(session);

            const req = {
                body: {
                    gateway_id: "GW-1",
                    lane_id: "L1",
                    trigger_type: "IC_CARD",
                    vehicle_type: "CAR",
                    lot_id: 1,
                    card_uid: "CARD-001",
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.ingestCheckinEvent(req, res);

            expect(edgeCheckinService.ingestCheckinEvent).toHaveBeenCalledWith(req.body);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Edge check-in event ingested successfully",
                session,
            });
        });

        it("returns 409 on duplicate active identity", async () => {
            edgeCheckinService.ingestCheckinEvent.mockRejectedValue({
                code: "23505",
                constraint: "uq_active_session_identity",
            });

            const req = {
                body: {
                    gateway_id: "GW-1",
                    lane_id: "L1",
                    trigger_type: "IC_CARD",
                    vehicle_type: "CAR",
                    lot_id: 1,
                    card_uid: "CARD-001",
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.ingestCheckinEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Duplicate active identity",
            });
        });

        it("returns 404 when lot is not found", async () => {
            edgeCheckinService.ingestCheckinEvent.mockRejectedValue({
                code: "LOT_NOT_FOUND",
                message: "Parking lot not found",
            });

            const req = {
                body: {
                    gateway_id: "GW-1",
                    lane_id: "L1",
                    trigger_type: "IC_CARD",
                    vehicle_type: "CAR",
                    lot_id: 999,
                    card_uid: "CARD-001",
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.ingestCheckinEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Parking lot not found",
            });
        });

        it("returns 422 for typed validation errors", async () => {
            edgeCheckinService.ingestCheckinEvent.mockRejectedValue({
                code: "VALIDATION_ERROR",
                publicMessage: "Invalid vehicle_type",
            });

            const req = {
                body: {
                    gateway_id: "GW-1",
                    lane_id: "L1",
                    trigger_type: "IC_CARD",
                    vehicle_type: "INVALID",
                    lot_id: 1,
                    card_uid: "CARD-001",
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.ingestCheckinEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid vehicle_type",
            });
        });

        it("returns 500 for unknown errors", async () => {
            edgeCheckinService.ingestCheckinEvent.mockRejectedValue(new Error("unexpected failure"));

            const req = {
                body: {
                    gateway_id: "GW-1",
                    lane_id: "L1",
                    trigger_type: "IC_CARD",
                    vehicle_type: "CAR",
                    lot_id: 1,
                    card_uid: "CARD-001",
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.ingestCheckinEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Internal server error",
            });
        });
    });
});
