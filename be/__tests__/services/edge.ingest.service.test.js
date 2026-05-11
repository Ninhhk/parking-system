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
    closeSession: jest.fn(),
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

    // -----------------------------------------------------------------------
    // Bug 2 exploration — exit events not routed (EXPECTED TO FAIL on unfixed code)
    // Property 1: for EXIT lane payloads, ingestEvent MUST route to exit processing:
    //   - active session exists → action = SESSION_CLOSED, startSession NOT called
    //   - no active session     → action = EXIT_NO_ACTIVE_SESSION, startSession NOT called
    // Validates: Requirements 1.3, 1.4
    // -----------------------------------------------------------------------
    describe("Bug 2 exploration — exit events not routed", () => {
        const basePayload = (overrides = {}) => ({
            event_id: "evt_exit_001",
            gateway_id: "gw-exit",
            lane_id: "lane-exit",
            occurred_at: "2026-01-01T00:00:00.000Z",
            lot_id: 1,
            vehicle_type: "car",
            lane_direction: "EXIT",
            ...overrides,
        });

        it("EXIT + IC_CARD with active session: action is SESSION_CLOSED and startSession is NOT called", async () => {
            edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
            edgeEventsRepo.createProcessing.mockResolvedValue({});
            sessionsRepo.findActiveByCardUid.mockResolvedValue({
                session_id: 2001,
                card_uid: "CARD-EXIT-001",
            });
            sessionsRepo.closeSession.mockResolvedValue({
                session_id: 2001,
                card_uid: "CARD-EXIT-001",
            });
            sessionsRepo.startSession.mockResolvedValue({ session_id: 9999 });

            const result = await edgeIngestService.ingestEvent(
                basePayload({
                    trigger: { type: "IC_CARD", value: "CARD-EXIT-001" },
                })
            );

            expect(result.action).toBe("SESSION_CLOSED");
            expect(sessionsRepo.startSession).not.toHaveBeenCalled();
        });

        it("EXIT + MANUAL with no active session: action is EXIT_NO_ACTIVE_SESSION and startSession is NOT called", async () => {
            edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
            edgeEventsRepo.createProcessing.mockResolvedValue({});
            sessionsRepo.findActiveByPlate.mockResolvedValue(null);
            sessionsRepo.startSession.mockResolvedValue({ session_id: 9999 });

            const result = await edgeIngestService.ingestEvent(
                basePayload({
                    trigger: { type: "MANUAL", value: "51A-99999" },
                })
            );

            expect(result.action).toBe("EXIT_NO_ACTIVE_SESSION");
            expect(sessionsRepo.startSession).not.toHaveBeenCalled();
        });

        // Config-authoritative test: lane_id exists in edge_gateways.json as EXIT,
        // so even without payload.lane_direction the config drives exit routing.
        it("EXIT via config lookup (lane-exit-1 in edge_gateways.json): action is SESSION_CLOSED", async () => {
            edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
            edgeEventsRepo.createProcessing.mockResolvedValue({});
            sessionsRepo.findActiveByCardUid.mockResolvedValue({
                session_id: 2050,
                card_uid: "CARD-CFG-EXIT",
            });
            sessionsRepo.closeSession.mockResolvedValue({
                session_id: 2050,
                card_uid: "CARD-CFG-EXIT",
            });
            sessionsRepo.startSession.mockResolvedValue({ session_id: 9999 });
            edgeEventsRepo.markSuccess.mockResolvedValue({});

            const result = await edgeIngestService.ingestEvent({
                event_id: "evt_cfg_exit_001",
                gateway_id: "gw-edge-1",
                lane_id: "lane-exit-1", // exists in edge_gateways.json with lane_direction: EXIT
                occurred_at: "2026-01-01T00:00:00.000Z",
                lot_id: 1,
                vehicle_type: "car",
                // No lane_direction in payload — config is authoritative
                trigger: { type: "IC_CARD", value: "CARD-CFG-EXIT" },
            });

            expect(result.action).toBe("SESSION_CLOSED");
            expect(sessionsRepo.startSession).not.toHaveBeenCalled();
            expect(sessionsRepo.closeSession).toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Bug 2 preservation — ENTRY path unchanged (MUST PASS on unfixed code)
    // Property 5: for all ENTRY payloads (including no lane_direction field),
    //   ingestEvent MUST NOT return action SESSION_CLOSED or EXIT_NO_ACTIVE_SESSION.
    // Validates: Requirements 2.9, 3.4, 3.5, 3.6, 3.7
    // -----------------------------------------------------------------------
    describe("Bug 2 preservation — ENTRY path unchanged", () => {
        const entryPayload = (overrides = {}) => ({
            event_id: "evt_entry_pres_001",
            gateway_id: "gw-a",
            lane_id: "lane-a",
            occurred_at: "2026-01-01T00:00:00.000Z",
            lot_id: 1,
            vehicle_type: "car",
            // No lane_direction field — defaults to ENTRY behavior
            ...overrides,
        });

        // Baseline: IC_CARD on ENTRY (no lane_direction) → SESSION_RESOLVED, not SESSION_CLOSED
        it("IC_CARD on ENTRY (no lane_direction) resolves session and action is never SESSION_CLOSED or EXIT_NO_ACTIVE_SESSION", async () => {
            edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
            edgeEventsRepo.createProcessing.mockResolvedValue({});
            sessionsRepo.findActiveByCardUid.mockResolvedValue(null);
            sessionsRepo.startSession.mockResolvedValue({ session_id: 3001, card_uid: "CARD-ENTRY-001" });
            edgeEventsRepo.markSuccess.mockResolvedValue({});

            const result = await edgeIngestService.ingestEvent(
                entryPayload({ trigger: { type: "IC_CARD", value: "CARD-ENTRY-001" } })
            );

            expect(result.action).not.toBe("SESSION_CLOSED");
            expect(result.action).not.toBe("EXIT_NO_ACTIVE_SESSION");
            expect(result.status).toBe("SUCCESS");
            expect(sessionsRepo.startSession).toHaveBeenCalled();
        });

        // LPD on ENTRY → enrichRecentSessionByLane path, action is SESSION_RESOLVED (not SESSION_CLOSED)
        it("LPD on ENTRY (no lane_direction) uses enrichRecentSessionByLane and action is never SESSION_CLOSED", async () => {
            edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
            edgeEventsRepo.createProcessing.mockResolvedValue({});
            sessionsRepo.enrichRecentSessionByLane.mockResolvedValue({ session_id: 3002 });
            edgeEventsRepo.markSuccess.mockResolvedValue({});

            const result = await edgeIngestService.ingestEvent(
                entryPayload({ trigger: { type: "LPD", plate: "51A12345" } })
            );

            expect(sessionsRepo.enrichRecentSessionByLane).toHaveBeenCalled();
            expect(result.action).not.toBe("SESSION_CLOSED");
            expect(result.action).not.toBe("EXIT_NO_ACTIVE_SESSION");
        });

        // Duplicate event_id on ENTRY → DUPLICATE regardless of direction
        it("duplicate event_id on ENTRY returns DUPLICATE action (unchanged)", async () => {
            edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue({
                event_id: "evt_entry_pres_001",
                status: "SUCCESS",
                session_id: 3003,
            });

            const result = await edgeIngestService.ingestEvent(
                entryPayload({ trigger: { type: "MANUAL", value: "51A12345" } })
            );

            expect(result.duplicate).toBe(true);
            expect(result.action).toBe("DUPLICATE");
            expect(result.action).not.toBe("SESSION_CLOSED");
            expect(result.action).not.toBe("EXIT_NO_ACTIVE_SESSION");
        });

        // Property: for all ENTRY trigger types (IC_CARD, UHF_TAG, MANUAL) with no lane_direction,
        // action is never SESSION_CLOSED or EXIT_NO_ACTIVE_SESSION
        const entryTriggerCases = [
            { type: "IC_CARD", value: "CARD-001", findMock: "findActiveByCardUid" },
            { type: "UHF_TAG", value: "TAG-001", findMock: "findActiveByEtagEpc" },
            { type: "MANUAL", value: "51A-00001", findMock: "findActiveByPlate" },
        ];

        it.each(entryTriggerCases)(
            "$type on ENTRY (no lane_direction) never produces SESSION_CLOSED or EXIT_NO_ACTIVE_SESSION",
            async ({ type, value, findMock }) => {
                edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
                edgeEventsRepo.createProcessing.mockResolvedValue({});
                sessionsRepo[findMock].mockResolvedValue(null);
                sessionsRepo.startSession.mockResolvedValue({ session_id: 4000 });
                edgeEventsRepo.markSuccess.mockResolvedValue({});

                const result = await edgeIngestService.ingestEvent(
                    entryPayload({
                        event_id: `evt_entry_pres_${type}`,
                        trigger: { type, value },
                    })
                );

                expect(result.action).not.toBe("SESSION_CLOSED");
                expect(result.action).not.toBe("EXIT_NO_ACTIVE_SESSION");
            }
        );

        // Explicit lane_direction: "ENTRY" also preserves entry behavior
        it("explicit lane_direction ENTRY still routes through entry path (SESSION_RESOLVED)", async () => {
            edgeEventsRepo.getByEventIdForUpdate.mockResolvedValue(null);
            edgeEventsRepo.createProcessing.mockResolvedValue({});
            sessionsRepo.findActiveByPlate.mockResolvedValue(null);
            sessionsRepo.startSession.mockResolvedValue({ session_id: 5001 });
            edgeEventsRepo.markSuccess.mockResolvedValue({});

            const result = await edgeIngestService.ingestEvent(
                entryPayload({
                    event_id: "evt_entry_explicit_001",
                    lane_direction: "ENTRY",
                    trigger: { type: "MANUAL", value: "51A-55555" },
                })
            );

            expect(result.action).not.toBe("SESSION_CLOSED");
            expect(result.action).not.toBe("EXIT_NO_ACTIVE_SESSION");
            expect(result.status).toBe("SUCCESS");
        });
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
