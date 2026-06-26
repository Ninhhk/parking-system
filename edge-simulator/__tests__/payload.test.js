/**
 * Unit + property tests for lib/payload.js
 *
 * **Validates: Requirements 1.2, 1.6, 1.7**
 * **Property 1: Payload construction produces schema-valid ingest request**
 */
const { buildPayload } = require("../lib/payload");
const fc = require("fast-check");
const path = require("path");

// UUID v4 regex
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --- Fixtures ---

const icCardScenario = {
    name: "Monthly card entry",
    gateway_id: "gw-edge-1",
    lane_id: "lane-card-lpd-1",
    trigger_type: "IC_CARD",
    vehicle_type: "bike",
    lot_id: "lot-1",
    trigger_value: "CARD-001",
};

const lpdScenarioWithPlate = {
    name: "LPD entry",
    gateway_id: "gw-edge-1",
    lane_id: "lane-card-lpd-1",
    trigger_type: "LPD",
    vehicle_type: "car",
    lot_id: "lot-1",
    plate: "29A-12345",
};

const lpdScenarioWithImage = {
    name: "LPD with image",
    gateway_id: "gw-edge-1",
    lane_id: "lane-card-lpd-1",
    trigger_type: "LPD",
    vehicle_type: "car",
    lot_id: "lot-1",
    plate: "29A-12345",
    image_path: "samples/plate.jpg",
};

// --- Unit Tests ---

describe("buildPayload", () => {
    test("returns object with valid UUID v4 event_id", () => {
        const payload = buildPayload(icCardScenario);
        expect(payload.event_id).toMatch(UUID_V4_RE);
    });

    test("returns object with valid ISO 8601 occurred_at", () => {
        const before = new Date().toISOString();
        const payload = buildPayload(icCardScenario);
        const after = new Date().toISOString();
        expect(payload.occurred_at).toBeDefined();
        // Verify it parses as valid date
        const parsed = new Date(payload.occurred_at);
        expect(parsed.toISOString()).toBe(payload.occurred_at);
        // Within reasonable time window
        expect(parsed.getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
        expect(parsed.getTime()).toBeLessThanOrEqual(new Date(after).getTime());
    });

    test("maps gateway_id, lane_id, lot_id, vehicle_type correctly", () => {
        const payload = buildPayload(icCardScenario);
        expect(payload.gateway_id).toBe("gw-edge-1");
        expect(payload.lane_id).toBe("lane-card-lpd-1");
        expect(payload.lot_id).toBe("lot-1");
        expect(payload.vehicle_type).toBe("bike");
    });

    test("maps trigger_type to trigger.type", () => {
        const payload = buildPayload(icCardScenario);
        expect(payload.trigger.type).toBe("IC_CARD");
    });

    test("maps trigger_value to trigger.value", () => {
        const payload = buildPayload(icCardScenario);
        expect(payload.trigger.value).toBe("CARD-001");
    });

    test("LPD scenario: trigger.plate is set", () => {
        const payload = buildPayload(lpdScenarioWithPlate);
        expect(payload.trigger.plate).toBe("29A-12345");
    });

    test("LPD with image_path: trigger.image_base64 is set", () => {
        const payload = buildPayload(lpdScenarioWithImage);
        expect(payload.trigger.image_base64).toBeDefined();
        expect(payload.trigger.image_base64.length).toBeGreaterThan(0);
        // Should be valid base64
        const decoded = Buffer.from(payload.trigger.image_base64, "base64");
        expect(decoded.length).toBeGreaterThan(0);
    });
});

// --- Property-Based Test ---

describe("Property 1: Payload construction produces schema-valid ingest request", () => {
    const validScenarioArb = fc.record({
        name: fc.string({ minLength: 1 }),
        gateway_id: fc.string({ minLength: 1 }),
        lane_id: fc.string({ minLength: 1 }),
        trigger_type: fc.constantFrom("IC_CARD", "UHF_TAG", "MANUAL"),
        vehicle_type: fc.constantFrom("car", "bike"),
        lot_id: fc.string({ minLength: 1 }),
        trigger_value: fc.string({ minLength: 1 }),
    });

    test("any valid scenario produces payload with UUID event_id, ISO occurred_at, and correct fields", () => {
        fc.assert(
            fc.property(validScenarioArb, (scenario) => {
                const payload = buildPayload(scenario);

                // event_id is UUID v4
                if (!UUID_V4_RE.test(payload.event_id)) return false;

                // occurred_at is valid ISO 8601
                const parsed = new Date(payload.occurred_at);
                if (isNaN(parsed.getTime())) return false;
                if (parsed.toISOString() !== payload.occurred_at) return false;

                // Required fields match scenario
                if (payload.gateway_id !== scenario.gateway_id) return false;
                if (payload.lane_id !== scenario.lane_id) return false;
                if (payload.lot_id !== scenario.lot_id) return false;
                if (payload.vehicle_type !== scenario.vehicle_type) return false;
                if (payload.trigger.type !== scenario.trigger_type) return false;
                if (payload.trigger.value !== scenario.trigger_value) return false;

                return true;
            }),
            { numRuns: 100 }
        );
    });
});
