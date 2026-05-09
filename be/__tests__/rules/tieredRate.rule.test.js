// Feature: fee-calculation-engine
// Tests for tieredRate.rule.js
// Requirements: 6.1, 6.2, 6.5

"use strict";

const { apply } = require("../../rules/tieredRate.rule");

function baseAcc(overrides = {}) {
    return {
        gracePeriodMinutes: 0,
        billableMinutes: 0,
        billableHours: 0,
        serviceFee: 0,
        penaltyFee: 0,
        dailyCapApplied: false,
        totalAmount: 0,
        configVersionId: null,
        ...overrides,
    };
}

describe("tieredRate.rule", () => {
    it("returns accumulator unchanged when tiered_rate_enabled = false", () => {
        const ctx = { config: { tiered_rate_enabled: false, tiers: [] } };
        const acc = baseAcc({ billableHours: 5, serviceFee: 12345 });
        const result = apply(ctx, acc);
        expect(result).toBe(acc);
        expect(result.serviceFee).toBe(12345);
    });

    it("single bracket (null upper bound) charges all hours at that rate", () => {
        const ctx = {
            config: {
                tiered_rate_enabled: true,
                tiers: [{ up_to_hours: null, rate_per_hour: 10000 }],
            },
        };
        const result = apply(ctx, baseAcc({ billableHours: 3 }));
        expect(result.serviceFee).toBe(30000);
    });

    it("two brackets: hours spanning both brackets are charged at respective rates", () => {
        // 2h @ 15000 + 3h @ 10000 = 30000 + 30000 = 60000
        const ctx = {
            config: {
                tiered_rate_enabled: true,
                tiers: [
                    { up_to_hours: 2, rate_per_hour: 15000 },
                    { up_to_hours: null, rate_per_hour: 10000 },
                ],
            },
        };
        const result = apply(ctx, baseAcc({ billableHours: 5 }));
        expect(result.serviceFee).toBe(60000);
    });

    it("hours exactly at bracket boundary use only the first bracket", () => {
        // 2h exactly → 2 * 15000 = 30000 (second bracket not entered)
        const ctx = {
            config: {
                tiered_rate_enabled: true,
                tiers: [
                    { up_to_hours: 2, rate_per_hour: 15000 },
                    { up_to_hours: null, rate_per_hour: 10000 },
                ],
            },
        };
        const result = apply(ctx, baseAcc({ billableHours: 2 }));
        expect(result.serviceFee).toBe(30000);
    });

    it("final bracket with null upper bound absorbs all remaining hours", () => {
        // 1h @ 20000 + 9h @ 5000 = 20000 + 45000 = 65000
        const ctx = {
            config: {
                tiered_rate_enabled: true,
                tiers: [
                    { up_to_hours: 1, rate_per_hour: 20000 },
                    { up_to_hours: null, rate_per_hour: 5000 },
                ],
            },
        };
        const result = apply(ctx, baseAcc({ billableHours: 10 }));
        expect(result.serviceFee).toBe(65000);
    });
});
