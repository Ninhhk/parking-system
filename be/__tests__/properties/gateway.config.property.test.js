const fc = require("fast-check");

// Mock the DB pool BEFORE requiring the controller. getLaneConfig calls
// pool.query for the camera check; we control its rowCount per run.
jest.mock("../../config/db", () => ({
    pool: { query: jest.fn() },
}));

const { pool } = require("../../config/db");
const controller = require("../../controllers/employee.gateway.controller");
const gatewayConfig = require("../../config/edge_gateways.json");

// Lane IDs that actually exist in edge_gateways.json — derived from the real
// config so the test stays in sync if lanes are added/removed.
const existingLaneIds = gatewayConfig.gateways.flatMap((gw) =>
    gw.lanes.map((lane) => lane.lane_id)
);
const existingLaneIdSet = new Set(existingLaneIds);

function freshRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
});

// Feature: unified-checkin-kiosk, Property 8: Gateway Config API — existing lane
// Validates: Requirements 6.1, 6.2, 6.3
describe("Feature: unified-checkin-kiosk, Property 8: Gateway Config API — existing lane", () => {
    it("returns 200 with a well-formed data object for any existing lane ID", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...existingLaneIds),
                // has_camera derives from the camera-existence query rowCount.
                fc.integer({ min: 0, max: 5 }),
                // lpd_enabled derives from the LPD-plate-camera query rowCount.
                fc.integer({ min: 0, max: 5 }),
                async (laneId, cameraRowCount, lpdRowCount) => {
                    // The controller issues up to two queries: a plain camera-existence
                    // check, and (only for LPD-permitting lanes) a check for an active
                    // plate camera with the LPD module enabled. Route by SQL shape.
                    pool.query.mockImplementation((sql) => {
                        if (typeof sql === "string" && sql.includes("camera_module_assignments")) {
                            return Promise.resolve({ rowCount: lpdRowCount });
                        }
                        return Promise.resolve({ rowCount: cameraRowCount });
                    });

                    const req = { params: { lane_id: laneId } };
                    const res = freshRes();

                    await controller.getLaneConfig(req, res);

                    expect(res.status).toHaveBeenCalledWith(200);

                    const payload = res.json.mock.calls[0][0];
                    expect(payload.success).toBe(true);

                    const data = payload.data;
                    // allowed_trigger_modules is an array
                    expect(Array.isArray(data.allowed_trigger_modules)).toBe(true);
                    // lane_direction is a string
                    expect(typeof data.lane_direction).toBe("string");
                    // vehicle_type is "car", "bike", or null
                    expect(
                        data.vehicle_type === "car" ||
                            data.vehicle_type === "bike" ||
                            data.vehicle_type === null
                    ).toBe(true);
                    // has_camera is a boolean reflecting the camera-existence rowCount
                    expect(typeof data.has_camera).toBe("boolean");
                    expect(data.has_camera).toBe(cameraRowCount > 0);

                    // lpd_enabled is a boolean: true only when the lane policy permits
                    // LPD AND an enabled LPD plate camera exists for the lane/direction.
                    const laneAllowsLpd = data.allowed_trigger_modules.some(
                        (m) => String(m).toUpperCase() === "LPD"
                    );
                    expect(typeof data.lpd_enabled).toBe("boolean");
                    expect(data.lpd_enabled).toBe(laneAllowsLpd && lpdRowCount > 0);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// Feature: unified-checkin-kiosk, Property 9: Gateway Config API — non-existing lane
// Validates: Requirements 6.3
describe("Feature: unified-checkin-kiosk, Property 9: Gateway Config API — non-existing lane", () => {
    it("returns 404 with { success: false, message } for any lane ID not in the config", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string().filter((s) => !existingLaneIdSet.has(s)),
                async (laneId) => {
                    pool.query.mockResolvedValue({ rowCount: 0 });

                    const req = { params: { lane_id: laneId } };
                    const res = freshRes();

                    await controller.getLaneConfig(req, res);

                    expect(res.status).toHaveBeenCalledWith(404);

                    const payload = res.json.mock.calls[0][0];
                    expect(payload.success).toBe(false);
                    expect(typeof payload.message).toBe("string");

                    // A non-existing lane must never reach the camera DB query.
                    expect(pool.query).not.toHaveBeenCalled();
                }
            ),
            { numRuns: 100 }
        );
    });
});
