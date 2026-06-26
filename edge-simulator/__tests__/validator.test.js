/**
 * Unit + property tests for lib/validator.js
 *
 * **Validates: Requirements 3.4, 3.5, 3.6**
 * **Property 2: Scenario validation rejects incomplete scenarios**
 */
const { validateScenario, validateAll } = require("../lib/validator");
const fc = require("fast-check");

// --- Fixtures ---

const validScenario = {
    name: "Test scenario",
    gateway_id: "gw-edge-1",
    lane_id: "lane-card-lpd-1",
    trigger_type: "IC_CARD",
    vehicle_type: "bike",
    lot_id: "lot-1",
    trigger_value: "CARD-001",
};

const validLpdScenario = {
    name: "LPD scenario",
    gateway_id: "gw-edge-1",
    lane_id: "lane-card-lpd-1",
    trigger_type: "LPD",
    vehicle_type: "car",
    lot_id: "lot-1",
    plate: "29A-12345",
};

// --- Unit Tests ---

describe("validateScenario", () => {
    test("valid complete IC_CARD scenario passes", () => {
        const result = validateScenario(validScenario);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    test("valid LPD scenario with plate passes", () => {
        const result = validateScenario(validLpdScenario);
        expect(result.valid).toBe(true);
    });

    test("valid LPD scenario with image_path passes", () => {
        const scenario = { ...validLpdScenario, plate: undefined, image_path: "samples/plate.jpg" };
        const result = validateScenario(scenario);
        expect(result.valid).toBe(true);
    });

    const REQUIRED_FIELDS = ["name", "gateway_id", "lane_id", "trigger_type", "vehicle_type", "lot_id"];

    test.each(REQUIRED_FIELDS)("missing required field '%s' → invalid", (field) => {
        const scenario = { ...validScenario };
        delete scenario[field];
        const result = validateScenario(scenario);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test("IC_CARD without trigger_value → invalid", () => {
        const scenario = { ...validScenario, trigger_value: undefined };
        const result = validateScenario(scenario);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("trigger_value"))).toBe(true);
    });

    test("UHF_TAG without trigger_value → invalid", () => {
        const scenario = { ...validScenario, trigger_type: "UHF_TAG", trigger_value: undefined };
        const result = validateScenario(scenario);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("trigger_value"))).toBe(true);
    });

    test("LPD without plate and without image_path → invalid", () => {
        const scenario = {
            name: "LPD no plate",
            gateway_id: "gw-1",
            lane_id: "lane-1",
            trigger_type: "LPD",
            vehicle_type: "car",
            lot_id: "lot-1",
        };
        const result = validateScenario(scenario);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes("LPD"))).toBe(true);
    });
});

describe("validateAll", () => {
    test("mix of valid and invalid scenarios", () => {
        const invalid = { ...validScenario, name: "" };
        const result = validateAll([validScenario, invalid]);
        expect(result.valid).toBe(false);
        expect(Object.keys(result.results).length).toBe(1);
    });

    test("all valid returns valid: true", () => {
        const result = validateAll([validScenario, validLpdScenario]);
        expect(result.valid).toBe(true);
        expect(Object.keys(result.results).length).toBe(0);
    });
});

// --- Property-Based Test ---

describe("Property 2: Scenario validation rejects incomplete scenarios", () => {
    const REQUIRED_FIELDS = ["name", "gateway_id", "lane_id", "trigger_type", "vehicle_type", "lot_id"];

    test("removing any required field from a valid scenario always rejects", () => {
        fc.assert(
            fc.property(
                fc.record({
                    name: fc.string({ minLength: 1 }),
                    gateway_id: fc.string({ minLength: 1 }),
                    lane_id: fc.string({ minLength: 1 }),
                    trigger_type: fc.constantFrom("MANUAL"),
                    vehicle_type: fc.constantFrom("car", "bike"),
                    lot_id: fc.string({ minLength: 1 }),
                }),
                fc.constantFrom(...REQUIRED_FIELDS),
                (scenario, fieldToRemove) => {
                    const incomplete = { ...scenario };
                    delete incomplete[fieldToRemove];
                    const result = validateScenario(incomplete);
                    return result.valid === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    test("IC_CARD/UHF_TAG without trigger_value always rejects", () => {
        fc.assert(
            fc.property(
                fc.record({
                    name: fc.string({ minLength: 1 }),
                    gateway_id: fc.string({ minLength: 1 }),
                    lane_id: fc.string({ minLength: 1 }),
                    trigger_type: fc.constantFrom("IC_CARD", "UHF_TAG"),
                    vehicle_type: fc.constantFrom("car", "bike"),
                    lot_id: fc.string({ minLength: 1 }),
                }),
                (scenario) => {
                    // No trigger_value set
                    const result = validateScenario(scenario);
                    return result.valid === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    test("LPD without plate and image_path always rejects", () => {
        fc.assert(
            fc.property(
                fc.record({
                    name: fc.string({ minLength: 1 }),
                    gateway_id: fc.string({ minLength: 1 }),
                    lane_id: fc.string({ minLength: 1 }),
                    trigger_type: fc.constant("LPD"),
                    vehicle_type: fc.constantFrom("car", "bike"),
                    lot_id: fc.string({ minLength: 1 }),
                }),
                (scenario) => {
                    // No plate or image_path
                    const result = validateScenario(scenario);
                    return result.valid === false;
                }
            ),
            { numRuns: 100 }
        );
    });
});
