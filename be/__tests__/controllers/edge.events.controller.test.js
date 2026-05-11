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
                retry_count: 0,
                max_retries: 3,
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

    // -----------------------------------------------------------------------
    // Bug 1 exploration — retry limit not enforced (EXPECTED TO FAIL on unfixed code)
    // Property 1: for all (retry_count, max_retries) where retry_count >= max_retries >= 0,
    //   retryEvent MUST return HTTP 409 { success: false, message: "Retry limit reached" }
    //   and MUST NOT call edgeEventsRepo.markForRetry.
    // Validates: Requirements 1.1, 1.2
    // -----------------------------------------------------------------------
    describe("Bug 1 exploration — retry limit not enforced", () => {
        const makeReq = (eventId) => ({ params: { eventId } });
        const makeRes = () => {
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            return res;
        };

        const failedEventAt = (retry_count, max_retries) => ({
            event_id: "evt_limit_001",
            status: "FAILED",
            retry_count,
            max_retries,
            payload_json: {
                event_id: "evt_limit_001",
                gateway_id: "gw-a",
                lane_id: "lane-a",
                occurred_at: "2026-01-01T00:00:00.000Z",
                lot_id: 1,
                vehicle_type: "car",
                trigger: { type: "MANUAL", value: "51A12345" },
            },
        });

        it("returns 409 and does NOT call markForRetry when retry_count = max_retries = 3", async () => {
            edgeEventsRepo.getByEventId.mockResolvedValue(failedEventAt(3, 3));
            const req = makeReq("evt_limit_001");
            const res = makeRes();

            await controller.retryEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Retry limit reached",
            });
            expect(edgeEventsRepo.markForRetry).not.toHaveBeenCalled();
        });

        it("returns 409 and does NOT call markForRetry when retry_count (5) > max_retries (3)", async () => {
            edgeEventsRepo.getByEventId.mockResolvedValue(failedEventAt(5, 3));
            const req = makeReq("evt_limit_001");
            const res = makeRes();

            await controller.retryEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Retry limit reached",
            });
            expect(edgeEventsRepo.markForRetry).not.toHaveBeenCalled();
        });

        it("returns 409 and does NOT call markForRetry when max_retries = 0 (zero retries allowed)", async () => {
            edgeEventsRepo.getByEventId.mockResolvedValue(failedEventAt(0, 0));
            const req = makeReq("evt_limit_001");
            const res = makeRes();

            await controller.retryEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Retry limit reached",
            });
            expect(edgeEventsRepo.markForRetry).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Bug 1 preservation — retry below limit proceeds (MUST PASS on unfixed code)
    // Property 2: for all FAILED events where retry_count < max_retries,
    //   retryEvent MUST call markForRetry and MUST NOT return 409 for the limit reason.
    // Validates: Requirements 2.2, 3.1
    // -----------------------------------------------------------------------
    describe("Bug 1 preservation — retry below limit proceeds", () => {
        const makeReq = (eventId) => ({ params: { eventId } });
        const makeRes = () => {
            const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            return res;
        };

        const failedEventBelow = (retry_count, max_retries) => ({
            event_id: "evt_below_limit_001",
            status: "FAILED",
            retry_count,
            max_retries,
            payload_json: {
                event_id: "evt_below_limit_001",
                gateway_id: "gw-a",
                lane_id: "lane-a",
                occurred_at: "2026-01-01T00:00:00.000Z",
                lot_id: 1,
                vehicle_type: "car",
                trigger: { type: "MANUAL", value: "51A12345" },
            },
        });

        // Concrete baseline: retry_count=2, max_retries=3 — the canonical below-limit case
        it("calls markForRetry and returns 200 when retry_count (2) < max_retries (3)", async () => {
            edgeEventsRepo.getByEventId.mockResolvedValue(failedEventBelow(2, 3));
            edgeEventsRepo.markForRetry.mockResolvedValue({});
            edgeIngestService.ingestEvent.mockResolvedValue({
                status: "SUCCESS",
                action: "SESSION_RESOLVED",
                session_id: 1001,
                event_id: "evt_below_limit_001",
            });
            edgeEventsRepo.updateAfterRetry.mockResolvedValue({});

            const req = makeReq("evt_below_limit_001");
            const res = makeRes();

            await controller.retryEvent(req, res);

            expect(edgeEventsRepo.markForRetry).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
            // Must NOT return 409 with "Retry limit reached"
            const jsonArg = res.json.mock.calls[0][0];
            expect(jsonArg).not.toEqual({ success: false, message: "Retry limit reached" });
        });

        // Property: for all retry_count in [0..max_retries-1], retryEvent never returns 409 for limit reason
        // Tested across representative pairs to cover the property space
        const belowLimitPairs = [
            [0, 1],
            [0, 3],
            [1, 2],
            [1, 3],
            [2, 3],
            [0, 10],
            [9, 10],
        ];

        it.each(belowLimitPairs)(
            "never returns 409 'Retry limit reached' when retry_count=%i < max_retries=%i",
            async (retry_count, max_retries) => {
                edgeEventsRepo.getByEventId.mockResolvedValue(failedEventBelow(retry_count, max_retries));
                edgeEventsRepo.markForRetry.mockResolvedValue({});
                edgeIngestService.ingestEvent.mockResolvedValue({
                    status: "SUCCESS",
                    action: "SESSION_RESOLVED",
                    session_id: 1001,
                    event_id: "evt_below_limit_001",
                });
                edgeEventsRepo.updateAfterRetry.mockResolvedValue({});

                const req = makeReq("evt_below_limit_001");
                const res = makeRes();

                await controller.retryEvent(req, res);

                // Must call markForRetry (retry proceeds)
                expect(edgeEventsRepo.markForRetry).toHaveBeenCalled();
                // Must NOT return 409 with limit message
                const statusArg = res.status.mock.calls[0][0];
                const jsonArg = res.json.mock.calls[0][0];
                const isLimitRejection =
                    statusArg === 409 &&
                    jsonArg &&
                    jsonArg.message === "Retry limit reached";
                expect(isLimitRejection).toBe(false);
            }
        );

        // Preservation: non-FAILED event still returns 409 "Only failed events can be retried"
        it("returns 409 'Only failed events can be retried' for non-FAILED event (unchanged)", async () => {
            edgeEventsRepo.getByEventId.mockResolvedValue({
                event_id: "evt_success_001",
                status: "SUCCESS",
                retry_count: 0,
                max_retries: 3,
                payload_json: {},
            });

            const req = makeReq("evt_success_001");
            const res = makeRes();

            await controller.retryEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Only failed events can be retried",
            });
            expect(edgeEventsRepo.markForRetry).not.toHaveBeenCalled();
        });

        // Preservation: missing event still returns 404
        it("returns 404 for missing event (unchanged)", async () => {
            edgeEventsRepo.getByEventId.mockResolvedValue(null);

            const req = makeReq("evt_nonexistent_001");
            const res = makeRes();

            await controller.retryEvent(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Edge event not found",
            });
            expect(edgeEventsRepo.markForRetry).not.toHaveBeenCalled();
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
