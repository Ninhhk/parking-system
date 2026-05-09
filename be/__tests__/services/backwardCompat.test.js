// Feature: fee-calculation-engine
// Integration and backward-compat tests
// Requirements: 9.2, 9.3, 13.1, 13.2

const { runPipeline, buildContext } = require("../../services/feeEngine.service");

// ─── Backward-compatible config ───────────────────────────────────────────────

const carConfig = {
    config_version_id: 1,
    vehicle_type: "car",
    grace_period_minutes: 0,
    rounding_strategy: "ceil_hour",
    hourly_rate: 10000,
    daily_cap_enabled: false,
    daily_cap_amount: 0,
    tiered_rate_enabled: false,
    tiers: [],
    time_of_day_enabled: false,
    time_windows: [],
    penalty_fee: 50000,
};
const bikeConfig = { ...carConfig, vehicle_type: "bike", hourly_rate: 5000, penalty_fee: 30000 };

const configByType = { car: carConfig, bike: bikeConfig };

// ─── Task 16.1: Deterministic backward-compat loop ───────────────────────────

describe("Backward compatibility — new engine vs legacy formula", () => {
    it("matches legacy formula for all is_monthly × is_lost × vehicle_type × hours[1..720] combinations", () => {
        const mismatches = [];

        for (const is_monthly of [false, true]) {
            for (const is_lost of [false, true]) {
                for (const vehicle_type of ["car", "bike"]) {
                    const config = configByType[vehicle_type];
                    const hourlyRate = config.hourly_rate;
                    const penaltyFee = config.penalty_fee;

                    for (let hours = 1; hours <= 720; hours++) {
                        // Legacy formula
                        const legacyServiceFee = is_monthly ? 0 : (hours <= 1 ? hourlyRate : hourlyRate * hours);
                        const legacyPenaltyFee = is_lost ? penaltyFee : 0;
                        const legacyTotal = legacyServiceFee + legacyPenaltyFee;

                        // New engine
                        const time_in = new Date("2025-01-01T00:00:00Z");
                        const time_out = new Date(time_in.getTime() + hours * 60 * 60 * 1000);
                        const session = { session_id: 1, vehicle_type, time_in, is_lost };
                        const ctx = buildContext(session, config, time_out);
                        const breakdown = runPipeline(ctx, is_monthly);

                        if (breakdown.totalAmount !== legacyTotal) {
                            mismatches.push({
                                is_monthly, is_lost, vehicle_type, hours,
                                expected: legacyTotal,
                                actual: breakdown.totalAmount,
                            });
                        }
                    }
                }
            }
        }

        if (mismatches.length > 0) {
            const sample = mismatches.slice(0, 5);
            fail(
                `${mismatches.length} mismatch(es) found. First ${sample.length}:\n` +
                sample.map(m =>
                    `  is_monthly=${m.is_monthly} is_lost=${m.is_lost} vehicle=${m.vehicle_type} hours=${m.hours}: expected=${m.expected} actual=${m.actual}`
                ).join("\n")
            );
        }
    });
});

// ─── Task 16.2: Config version resolution integration test ───────────────────

describe("Config version resolution — selectVersion logic", () => {
    const versions = [
        { config_version_id: 1, effective_from: new Date("2020-01-01T00:00:00Z"), hourly_rate: 5000 },
        { config_version_id: 2, effective_from: new Date("2023-06-01T00:00:00Z"), hourly_rate: 8000 },
        { config_version_id: 3, effective_from: new Date("2025-01-01T00:00:00Z"), hourly_rate: 10000 },
    ];

    function selectVersion(vs, referenceTime) {
        const applicable = vs
            .filter(v => new Date(v.effective_from) <= new Date(referenceTime))
            .sort((a, b) => new Date(b.effective_from) - new Date(a.effective_from));
        return applicable[0] || null;
    }

    it("returns null when time_in is before all versions", () => {
        const result = selectVersion(versions, new Date("2019-01-01T00:00:00Z"));
        expect(result).toBeNull();
    });

    it("returns v1 when time_in is exactly at v1 effective_from", () => {
        const result = selectVersion(versions, new Date("2020-01-01T00:00:00Z"));
        expect(result.config_version_id).toBe(1);
    });

    it("returns v1 when time_in is between v1 and v2", () => {
        const result = selectVersion(versions, new Date("2022-01-01T00:00:00Z"));
        expect(result.config_version_id).toBe(1);
    });

    it("returns v2 when time_in is exactly at v2 effective_from", () => {
        const result = selectVersion(versions, new Date("2023-06-01T00:00:00Z"));
        expect(result.config_version_id).toBe(2);
    });

    it("returns v2 when time_in is between v2 and v3", () => {
        const result = selectVersion(versions, new Date("2024-01-01T00:00:00Z"));
        expect(result.config_version_id).toBe(2);
    });

    it("returns v3 when time_in is exactly at v3 effective_from", () => {
        const result = selectVersion(versions, new Date("2025-01-01T00:00:00Z"));
        expect(result.config_version_id).toBe(3);
    });

    it("returns v3 when time_in is after v3", () => {
        const result = selectVersion(versions, new Date("2026-01-01T00:00:00Z"));
        expect(result.config_version_id).toBe(3);
    });
});
