const edgeEventsRepo = require("../../repositories/edge.events.repo");
const sessionsRepo = require("../../repositories/employee.sessions.repo");
const edgeIngestService = require("../../services/edge.ingest.service");
const controller = require("../../controllers/edge.events.controller");

jest.mock("../../repositories/edge.events.repo");
jest.mock("../../repositories/employee.sessions.repo");
jest.mock("../../services/edge.ingest.service");

describe("edge.events.controller", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("retryEvent", () => {
        it("returns 422 when eventId is missing", async () => {
            const req = {
                params: {},
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.retryEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(422);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "eventId is required",
            });
            expect(edgeEventsRepo.getByEventId).not.toHaveBeenCalled();
            expect(edgeIngestService.ingestEvent).not.toHaveBeenCalled();
        });

        it("replays failed event payload as-is with allowReplay option", async () => {
            const req = {
                params: { eventId: "evt_failed_001" },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            const payloadJson = {
                event_id: "evt_failed_001",
                gateway_id: "gw-a",
                lane_id: "lane-a",
                occurred_at: "2026-01-01T00:00:00.000Z",
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "MANUAL",
                    value: "51A12345",
                },
            };

            edgeEventsRepo.getByEventId.mockResolvedValue({
                event_id: "evt_failed_001",
                status: "FAILED",
                payload_json: payloadJson,
            });
            edgeEventsRepo.markForRetry.mockResolvedValue({});
            edgeIngestService.ingestEvent.mockResolvedValue({
                status: "SUCCESS",
                action: "SESSION_RESOLVED",
                session_id: 1001,
                event_id: "evt_failed_001",
            });
            edgeEventsRepo.updateAfterRetry.mockResolvedValue({});

            await controller.retryEvent(req, res);

            expect(edgeIngestService.ingestEvent).toHaveBeenCalledWith(payloadJson, { allowReplay: true });
            expect(edgeIngestService.ingestEvent).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    event_id: expect.stringMatching(/^evt_failed_001__retry_/),
                }),
                expect.anything()
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({
                    status: "SUCCESS",
                    event_id: "evt_failed_001",
                }),
            });
        });
    });

    describe("listEvents", () => {
        it("returns 200 with events list", async () => {
            edgeEventsRepo.listEvents.mockResolvedValue([
                { event_id: "evt_001", status: "FAILED" },
                { event_id: "evt_002", status: "SUCCESS" },
            ]);

            const req = {
                query: {
                    status: "FAILED",
                    lane: "lane-a",
                    trigger: "LPD",
                    q: "51A",
                    from: "2026-01-01T00:00:00.000Z",
                    to: "2026-01-02T00:00:00.000Z",
                    page: "1",
                    pageSize: "20",
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.listEvents(req, res);

            expect(edgeEventsRepo.listEvents).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: "FAILED",
                    lane: "lane-a",
                    trigger: "LPD",
                    q: "51A",
                    from: "2026-01-01T00:00:00.000Z",
                    to: "2026-01-02T00:00:00.000Z",
                    page: "1",
                    pageSize: "20",
                })
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.any(Array),
            });
        });
    });

    describe("getEventDetail", () => {
        it("returns 404 when event is not found", async () => {
            edgeEventsRepo.getByEventId.mockResolvedValue(null);

            const req = {
                params: { eventId: "evt_missing_001" },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.getEventDetail(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Edge event not found",
            });
        });

        it("returns 200 when event is found", async () => {
            edgeEventsRepo.getByEventId.mockResolvedValue({
                event_id: "evt_found_001",
                status: "FAILED",
            });

            const req = {
                params: { eventId: "evt_found_001" },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.getEventDetail(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.objectContaining({ event_id: "evt_found_001" }),
            });
        });
    });

    describe("getActiveSessions", () => {
        it("returns 200 with active sessions", async () => {
            sessionsRepo.getActiveSessionsForOps.mockResolvedValue([
                { session_id: 1001, license_plate: "51A12345" },
                { session_id: 1002, license_plate: "51A67890" },
            ]);

            const req = {
                query: {
                    laneId: "lane-a",
                    q: "51A",
                    page: "1",
                    pageSize: "10",
                },
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn(),
            };

            await controller.getActiveSessions(req, res);

            expect(sessionsRepo.getActiveSessionsForOps).toHaveBeenCalledWith(
                expect.objectContaining({
                    laneId: "lane-a",
                    q: "51A",
                    page: "1",
                    pageSize: "10",
                })
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: expect.any(Array),
            });
        });
    });
});
