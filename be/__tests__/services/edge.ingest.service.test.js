const mockConnect = jest.fn();

jest.mock("../../config/db", () => ({
    pool: {
        connect: () => mockConnect(),
    },
}));

jest.mock("../../repositories/edge.events.repo", () => ({
    getByEventIdForUpdate: jest.fn(),
    createProcessing: jest.fn(),
    markSuccess: jest.fn(),
    markFailed: jest.fn(),
}));

jest.mock("../../repositories/employee.sessions.repo", () => ({
    enrichRecentSessionByLane: jest.fn(),
    findActiveByCardUid: jest.fn(),
    findActiveByEtagEpc: jest.fn(),
    findActiveByPlate: jest.fn(),
    startSession: jest.fn(),
}));

const edgeEventsRepo = require("../../repositories/edge.events.repo");
const sessionsRepo = require("../../repositories/employee.sessions.repo");
const edgeIngestService = require("../../services/edge.ingest.service");

describe("edge.ingest service", () => {
    let dbClient;

    beforeEach(() => {
        jest.clearAllMocks();
        dbClient = {
            query: jest.fn().mockResolvedValue({ rows: [] }),
            release: jest.fn(),
        };
        mockConnect.mockReturnValue(dbClient);
    });

    it("returns duplicate response without reprocessing when event is already SUCCESS", async () => {
        edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue({
            event_id: "evt_dup_success_001",
            status: "SUCCESS",
            session_id: 321,
        });

        const result = await edgeIngestService.ingestEvent({
            event_id: "evt_dup_success_001",
            gateway_id: "gw-a",
            lane_id: "lane-a",
            occurred_at: new Date().toISOString(),
            lot_id: 1,
            vehicle_type: "car",
            trigger: {
                type: "MANUAL",
                value: "51G-39466",
            },
        });

        expect(result.duplicate).toBe(true);
        expect(result.action).toBe("DUPLICATE");
        expect(result.session_id).toBe(321);
        expect(edgeEventsRepo.createProcessing).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
        expect(dbClient.query).toHaveBeenCalledWith("BEGIN");
        expect(dbClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("reprocesses existing event when allowReplay is true", async () => {
        edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue({
            event_id: "evt_retry_001",
            status: "FAILED",
            session_id: null,
        });
        sessionsRepo.findActiveByPlate.mockResolvedValue(null);
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 777,
            license_plate: "51A12345",
        });
        edgeEventsRepo.markSuccess.mockResolvedValue({
            event_id: "evt_retry_001",
            status: "SUCCESS",
            session_id: 777,
        });

        const result = await edgeIngestService.ingestEvent(
            {
                event_id: "evt_retry_001",
                gateway_id: "gw-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "MANUAL",
                    value: "51A-12345",
                },
            },
            { allowReplay: true }
        );

        expect(result).toEqual(
            expect.objectContaining({
                duplicate: false,
                status: "SUCCESS",
                action: "SESSION_RESOLVED",
                event_id: "evt_retry_001",
                session_id: 777,
            })
        );
        expect(edgeEventsRepo.createProcessing).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).toHaveBeenCalled();
        expect(edgeEventsRepo.markSuccess).toHaveBeenCalledWith(
            {
                eventId: "evt_retry_001",
                sessionId: 777,
            },
            dbClient
        );
        expect(dbClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("creates processing row and resolves manual trigger into a session", async () => {
        edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
        edgeEventsRepo.createProcessing.mockResolvedValue({
            event_id: "evt_manual_001",
            status: "PROCESSING",
        });
        sessionsRepo.findActiveByPlate.mockResolvedValue(null);
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 999,
            license_plate: "51G-39466",
        });
        edgeEventsRepo.markSuccess.mockResolvedValue({
            event_id: "evt_manual_001",
            status: "SUCCESS",
            session_id: 999,
        });

        const result = await edgeIngestService.ingestEvent({
            event_id: "evt_manual_001",
            gateway_id: "gw-a",
            lane_id: "lane-a",
            occurred_at: new Date().toISOString(),
            lot_id: 1,
            vehicle_type: "car",
            trigger: {
                type: "MANUAL",
                value: "51g-394.66",
            },
        });

        expect(result.duplicate).toBe(false);
        expect(result.status).toBe("SUCCESS");
        expect(result.action).toBe("SESSION_RESOLVED");
        expect(result.session_id).toBe(999);
        expect(edgeEventsRepo.createProcessing).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: "evt_manual_001",
                laneId: "lane-a",
            }),
            dbClient
        );
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({
                lot_id: 1,
                vehicle_type: "car",
                license_plate: "51G-39466",
                entry_lane_id: "lane-a",
            }),
            dbClient
        );
        expect(edgeEventsRepo.markSuccess).toHaveBeenCalledWith(
            {
                eventId: "evt_manual_001",
                sessionId: 999,
            },
            dbClient
        );
    });

    it("marks event failed when LPD cannot match any recent session", async () => {
        edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
        edgeEventsRepo.createProcessing.mockResolvedValue({
            event_id: "evt_lpd_unmatched_001",
            status: "PROCESSING",
        });
        sessionsRepo.enrichRecentSessionByLane.mockResolvedValue(null);

        const result = await edgeIngestService.ingestEvent({
            event_id: "evt_lpd_unmatched_001",
            gateway_id: "gw-a",
            lane_id: "lane-a",
            occurred_at: new Date().toISOString(),
            lot_id: 1,
            vehicle_type: "car",
            trigger: {
                type: "LPD",
                plate: "51G39466",
            },
        });

        expect(result).toEqual(
            expect.objectContaining({
                duplicate: false,
                status: "FAILED",
                action: "LPD_UNMATCHED",
                session_id: null,
                event_id: "evt_lpd_unmatched_001",
            })
        );
        expect(edgeEventsRepo.markFailed).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: "evt_lpd_unmatched_001",
                errorCode: "LPD_UNMATCHED",
            }),
            dbClient
        );
        expect(edgeEventsRepo.markSuccess).not.toHaveBeenCalled();
        expect(dbClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("disables retry_count increment on replay when LPD still cannot match", async () => {
        edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue({
            event_id: "evt_retry_lpd_unmatched_001",
            status: "FAILED",
            session_id: null,
        });
        sessionsRepo.enrichRecentSessionByLane.mockResolvedValue(null);

        const result = await edgeIngestService.ingestEvent(
            {
                event_id: "evt_retry_lpd_unmatched_001",
                gateway_id: "gw-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "LPD",
                    plate: "51G39466",
                },
            },
            { allowReplay: true }
        );

        expect(result).toEqual(
            expect.objectContaining({
                duplicate: false,
                status: "FAILED",
                action: "LPD_UNMATCHED",
                session_id: null,
                event_id: "evt_retry_lpd_unmatched_001",
            })
        );
        expect(edgeEventsRepo.markFailed).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: "evt_retry_lpd_unmatched_001",
                errorCode: "LPD_UNMATCHED",
            }),
            dbClient,
            { incrementRetry: false }
        );
        expect(edgeEventsRepo.createProcessing).not.toHaveBeenCalled();
        expect(dbClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("marks event failed when session creation returns null due to full capacity", async () => {
        edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
        edgeEventsRepo.createProcessing.mockResolvedValue({
            event_id: "evt_manual_capacity_full_001",
            status: "PROCESSING",
        });
        sessionsRepo.findActiveByPlate.mockResolvedValue(null);
        sessionsRepo.startSession.mockResolvedValue(null);

        const result = await edgeIngestService.ingestEvent({
            event_id: "evt_manual_capacity_full_001",
            gateway_id: "gw-a",
            lane_id: "lane-a",
            occurred_at: new Date().toISOString(),
            lot_id: 1,
            vehicle_type: "car",
            trigger: {
                type: "MANUAL",
                value: "51A-12345",
            },
        });

        expect(result).toEqual(
            expect.objectContaining({
                duplicate: false,
                status: "FAILED",
                action: "CAPACITY_FULL",
                session_id: null,
                event_id: "evt_manual_capacity_full_001",
            })
        );
        expect(edgeEventsRepo.markFailed).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: "evt_manual_capacity_full_001",
                errorCode: "CAPACITY_FULL",
            }),
            dbClient
        );
        expect(edgeEventsRepo.markSuccess).not.toHaveBeenCalled();
        expect(dbClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("disables retry_count increment on replay when capacity remains full", async () => {
        edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue({
            event_id: "evt_retry_capacity_full_001",
            status: "FAILED",
            session_id: null,
        });
        sessionsRepo.findActiveByPlate.mockResolvedValue(null);
        sessionsRepo.startSession.mockResolvedValue(null);

        const result = await edgeIngestService.ingestEvent(
            {
                event_id: "evt_retry_capacity_full_001",
                gateway_id: "gw-a",
                lane_id: "lane-a",
                occurred_at: new Date().toISOString(),
                lot_id: 1,
                vehicle_type: "car",
                trigger: {
                    type: "MANUAL",
                    value: "51A-12345",
                },
            },
            { allowReplay: true }
        );

        expect(result).toEqual(
            expect.objectContaining({
                duplicate: false,
                status: "FAILED",
                action: "CAPACITY_FULL",
                session_id: null,
                event_id: "evt_retry_capacity_full_001",
            })
        );
        expect(edgeEventsRepo.markFailed).toHaveBeenCalledWith(
            expect.objectContaining({
                eventId: "evt_retry_capacity_full_001",
                errorCode: "CAPACITY_FULL",
            }),
            dbClient,
            { incrementRetry: false }
        );
        expect(edgeEventsRepo.createProcessing).not.toHaveBeenCalled();
        expect(dbClient.query).toHaveBeenCalledWith("COMMIT");
    });

    it("trims IC_CARD trigger.value before processing lookup and session creation", async () => {
        edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
        edgeEventsRepo.createProcessing.mockResolvedValue({
            event_id: "evt_ic_trim_001",
            status: "PROCESSING",
        });
        sessionsRepo.findActiveByCardUid.mockResolvedValue(null);
        sessionsRepo.startSession.mockResolvedValue({
            session_id: 1001,
            card_uid: "CARD-001",
        });

        await edgeIngestService.ingestEvent({
            event_id: "evt_ic_trim_001",
            gateway_id: "gw-a",
            lane_id: "lane-a",
            occurred_at: new Date().toISOString(),
            lot_id: 1,
            vehicle_type: "car",
            trigger: {
                type: "IC_CARD",
                value: "  CARD-001  ",
            },
        });

        expect(edgeEventsRepo.createProcessing).toHaveBeenCalledWith(
            expect.objectContaining({
                triggerType: "IC_CARD",
                triggerValue: "CARD-001",
            }),
            dbClient
        );
        expect(sessionsRepo.findActiveByCardUid).toHaveBeenCalledWith("CARD-001", dbClient);
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(
            expect.objectContaining({
                card_uid: "CARD-001",
            }),
            dbClient
        );
    });
});
