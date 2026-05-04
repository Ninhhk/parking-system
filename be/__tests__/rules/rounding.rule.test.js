// Feature: fee-calculation-engine
// Tests for rounding.rule.js
// Requirements: 4.1, 4.2, 4.3

"use strict";

const { apply } = require("../../rules/rounding.rule");

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

function makeCtx(strategy) {
    return { config: { rounding_strategy: strategy } };
}

describe("rounding.rule", () => {
    describe("ceil_hour strategy", () => {
        it("rounds 61 minutes up to 2 hours", () => {
            const result = apply(makeCtx("ceil_hour"), baseAcc({ billableMinutes: 61 }));
            expect(result.billableHours).toBe(2);
        });

        it("keeps exactly 60 minutes as 1 hour", () => {
            const result = apply(makeCtx("ceil_hour"), baseAcc({ billableMinutes: 60 }));
            expect(result.billableHours).toBe(1);
        });

        it("rounds 1 minute up to 1 hour", () => {
            const result = apply(makeCtx("ceil_hour"), baseAcc({ billableMinutes: 1 }));
            expect(result.billableHours).toBe(1);
        });

        it("returns 0 hours for 0 minutes", () => {
            const result = apply(makeCtx("ceil_hour"), baseAcc({ billableMinutes: 0 }));
            expect(result.billableHours).toBe(0);
        });
    });

    describe("ceil_half_hour strategy", () => {
        it("rounds 31 minutes up to 1 hour (2 half-hours)", () => {
            const result = apply(makeCtx("ceil_half_hour"), baseAcc({ billableMinutes: 31 }));
            expect(result.billableHours).toBe(1);
        });

        it("keeps exactly 30 minutes as 0.5 hours", () => {
            const result = apply(makeCtx("ceil_half_hour"), baseAcc({ billableMinutes: 30 }));
            expect(result.billableHours).toBe(0.5);
        });

        it("rounds 91 minutes up to 2 hours (1h31m → next half-hour boundary)", () => {
            const result = apply(makeCtx("ceil_half_hour"), baseAcc({ billableMinutes: 91 }));
            expect(result.billableHours).toBe(2);
        });

        it("returns 0 hours for 0 minutes", () => {
            const result = apply(makeCtx("ceil_half_hour"), baseAcc({ billableMinutes: 0 }));
            expect(result.billableHours).toBe(0);
        });
    });

    describe("exact_minutes strategy", () => {
        it("converts 90 minutes to 1.5 hours", () => {
            const result = apply(makeCtx("exact_minutes"), baseAcc({ billableMinutes: 90 }));
            expect(result.billableHours).toBe(1.5);
        });

        it("converts 45 minutes to 0.75 hours", () => {
            const result = apply(makeCtx("exact_minutes"), baseAcc({ billableMinutes: 45 }));
            expect(result.billableHours).toBe(0.75);
        });

        it("returns 0 hours for 0 minutes", () => {
            const result = apply(makeCtx("exact_minutes"), baseAcc({ billableMinutes: 0 }));
            expect(result.billableHours).toBe(0);
        });
    });
});
