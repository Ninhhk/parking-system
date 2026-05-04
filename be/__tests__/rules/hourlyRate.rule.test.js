// Feature: fee-calculation-engine
// Tests for hourlyRate.rule.js
// Requirements: 3.1, 3.4, 6.4

"use strict";

const { apply } = require("../../rules/hourlyRate.rule");

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

describe("hourlyRate.rule", () => {
    it("multiplies billableHours by hourly_rate to produce serviceFee", () => {
        const ctx = { config: { tiered_rate_enabled: false, hourly_rate: 10000 } };
        const result = apply(ctx, baseAcc({ billableHours: 2 }));
        expect(result.serviceFee).toBe(20000);
    });

    it("produces serviceFee = 0 when billableHours = 0", () => {
        const ctx = { config: { tiered_rate_enabled: false, hourly_rate: 10000 } };
        const result = apply(ctx, baseAcc({ billableHours: 0 }));
        expect(result.serviceFee).toBe(0);
    });

    it("returns accumulator unchanged when tiered_rate_enabled = true", () => {
        const ctx = { config: { tiered_rate_enabled: true, hourly_rate: 10000 } };
        const acc = baseAcc({ billableHours: 3, serviceFee: 99999 });
        const result = apply(ctx, acc);
        expect(result).toBe(acc); // same reference — rule returns acc unchanged
        expect(result.serviceFee).toBe(99999);
    });
});
