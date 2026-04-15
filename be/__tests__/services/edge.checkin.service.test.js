jest.mock("../../config/db", () => ({
    pool: {
        connect: jest.fn(),
    },
}));

jest.mock("../../repositories/employee.sessions.repo", () => ({
    enrichRecentSessionByLane: jest.fn(),
    startSession: jest.fn(),
}));

const { pool } = require("../../config/db");
const sessionsRepo = require("../../repositories/employee.sessions.repo");
const edgeCheckinService = require("../../services/edge.checkin.service");

function stableAdvisoryKey(namespace, value) {
    const text = `${namespace}:${value || ""}`;
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash | 0;
}

describe("edge.checkin.service lane module policy", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("rejects unsupported trigger module for lane", async () => {
        await expect(edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-1",
            lane_id: "lane-card-lpd-1",
            trigger_type: "UHF",
            lot_id: 1,
            vehicle_type: "car",
            etag_epc: "EPC-001",
        })).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
            publicMessage: "Lane module disabled",
        });

        expect(pool.connect).not.toHaveBeenCalled();
    });

    test("rejects when gateway_id is missing", async () => {
        await expect(edgeCheckinService.ingestCheckinEvent({
            lane_id: "lane-card-lpd-1",
            trigger_type: "CARD",
            lot_id: 1,
            vehicle_type: "car",
            card_uid: "CARD-001",
        })).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
            publicMessage: "gateway_id is required for edge check-in event",
        });

        expect(pool.connect).not.toHaveBeenCalled();
    });

    test("rejects when lane_id is missing", async () => {
        await expect(edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-1",
            trigger_type: "CARD",
            lot_id: 1,
            vehicle_type: "car",
            card_uid: "CARD-001",
        })).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
            publicMessage: "lane_id is required for edge check-in event",
        });

        expect(pool.connect).not.toHaveBeenCalled();
    });

    test("uses lane-specific correlation window for LPD enrich", async () => {
        const query = jest.fn();
        const release = jest.fn();
        pool.connect.mockResolvedValue({ query, release });

        sessionsRepo.enrichRecentSessionByLane.mockResolvedValue({
            session_id: 11,
            entry_lane_id: "lane-concurrent-1",
            license_plate: "LPD-111",
        });

        const result = await edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-1",
            lane_id: "lane-concurrent-1",
            trigger_type: "LPD",
            lot_id: 1,
            vehicle_type: "car",
            license_plate: "LPD-111",
        });

        expect(sessionsRepo.enrichRecentSessionByLane).toHaveBeenCalledWith(expect.objectContaining({
            entry_lane_id: "lane-concurrent-1",
            window_seconds: 7,
        }), { client: { query, release } });
        expect(sessionsRepo.startSession).not.toHaveBeenCalled();
        expect(query).toHaveBeenCalledWith("BEGIN");
        expect(query).toHaveBeenCalledWith("COMMIT");
        expect(release).toHaveBeenCalled();
        expect(result).toMatchObject({ session_id: 11 });
    });

    test("falls back to default correlation window when lane config omits it", async () => {
        const query = jest.fn();
        const release = jest.fn();
        pool.connect.mockResolvedValue({ query, release });

        sessionsRepo.startSession.mockResolvedValue({
            session_id: 12,
            entry_lane_id: "lane-uhf-only-1",
        });

        sessionsRepo.enrichRecentSessionByLane.mockResolvedValue({
            session_id: 12,
            entry_lane_id: "lane-uhf-only-1",
        });

        await edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-1",
            lane_id: "lane-uhf-only-1",
            trigger_type: "UHF",
            lot_id: 1,
            vehicle_type: "car",
            etag_epc: "EPC-001",
        });

        expect(sessionsRepo.enrichRecentSessionByLane).not.toHaveBeenCalled();
        expect(sessionsRepo.startSession).toHaveBeenCalledWith(expect.objectContaining({
            etag_epc: "EPC-001",
        }), { client: { query, release } });
        expect(query).toHaveBeenCalledWith("BEGIN");
        expect(query).toHaveBeenCalledWith("COMMIT");
        expect(release).toHaveBeenCalled();
    });

    test("uses deterministic advisory lock keys derived from gateway_id and lane_id", async () => {
        const query = jest.fn();
        const release = jest.fn();
        pool.connect.mockResolvedValue({ query, release });

        sessionsRepo.startSession.mockResolvedValue({
            session_id: 99,
            entry_lane_id: "lane-mixed-1",
        });

        await edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-2",
            lane_id: "lane-mixed-1",
            trigger_type: "CARD",
            lot_id: 1,
            vehicle_type: "car",
            card_uid: "CARD-LOCK-001",
        });

        expect(query).toHaveBeenCalledWith(
            "SELECT pg_advisory_xact_lock($1, $2)",
            [
                stableAdvisoryKey("gateway", "gw-edge-2"),
                stableAdvisoryKey("lane", "lane-mixed-1"),
            ]
        );
        expect(query).toHaveBeenCalledWith("COMMIT");
        expect(release).toHaveBeenCalled();
    });

    test("maps repository capacity-full signal to a 409 business error", async () => {
        const query = jest.fn();
        const release = jest.fn();
        pool.connect.mockResolvedValue({ query, release });

        sessionsRepo.startSession.mockResolvedValue(null);

        await expect(edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-1",
            lane_id: "lane-card-lpd-1",
            trigger_type: "CARD",
            lot_id: 1,
            vehicle_type: "car",
            card_uid: "CARD-FULL-001",
        })).rejects.toMatchObject({
            status: 409,
            code: "LOT_CAPACITY_FULL",
            publicMessage: "Parking lot is full for cars",
        });

        expect(query).toHaveBeenCalledWith("BEGIN");
        expect(query).toHaveBeenCalledWith("ROLLBACK");
        expect(query).not.toHaveBeenCalledWith("COMMIT");
        expect(release).toHaveBeenCalled();
    });

    test("rejects when lane configuration is missing", async () => {
        await expect(edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-1",
            lane_id: "unknown-lane",
            trigger_type: "CARD",
            lot_id: 1,
            vehicle_type: "car",
            card_uid: "CARD-1",
        })).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
            publicMessage: "Lane configuration not found",
        });

        expect(pool.connect).not.toHaveBeenCalled();
    });

    test("rejects LPD create fallback when lot_id or vehicle_type missing", async () => {
        const query = jest.fn();
        const release = jest.fn();
        pool.connect.mockResolvedValue({ query, release });

        sessionsRepo.enrichRecentSessionByLane.mockResolvedValue(null);

        await expect(edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-1",
            lane_id: "lane-card-lpd-1",
            trigger_type: "LPD",
            license_plate: "30A12345",
        })).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
            publicMessage: "lot_id and vehicle_type are required when LPD event needs session creation",
        });

        expect(query).toHaveBeenCalledWith("BEGIN");
        expect(query).toHaveBeenCalledWith("ROLLBACK");
        expect(release).toHaveBeenCalled();
    });

    test("rejects non-LPD events without lot_id or vehicle_type", async () => {
        const query = jest.fn();
        const release = jest.fn();
        pool.connect.mockResolvedValue({ query, release });

        await expect(edgeCheckinService.ingestCheckinEvent({
            gateway_id: "gw-edge-1",
            lane_id: "lane-card-lpd-1",
            trigger_type: "CARD",
            card_uid: "CARD-001",
        })).rejects.toMatchObject({
            status: 422,
            code: "VALIDATION_ERROR",
            publicMessage: "lot_id and vehicle_type are required for non-LPD check-in events",
        });

        expect(query).toHaveBeenCalledWith("BEGIN");
        expect(query).toHaveBeenCalledWith("ROLLBACK");
        expect(release).toHaveBeenCalled();
    });
});
