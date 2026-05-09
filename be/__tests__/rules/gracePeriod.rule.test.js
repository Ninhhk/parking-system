// Feature: fee-calculation-engine
// Tests for gracePeriod.rule.js
// Requirements: 2.1, 2.2, 2.4

"use strict";

const { apply } = require("../../rules/gracePeriod.rule");

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

function makeCtx(durationMinutes, gracePeriodMinutes) {
    const timeIn = new Date("2025-01-01T10:00:00Z");
    const timeOut = new Date(timeIn.getTime() + durationMinutes * 60 * 1000);
    return {
        session: { time_in: timeIn, time_out: timeOut },
        config: { grace_period_minutes: gracePeriodMinutes },
    };
}

describe("gracePeriod.rule", () => {
    describe("session within grace period", () => {
        it("sets serviceFee = 0 and billableMinutes = 0 when duration < grace period", () => {
            const ctx = makeCtx(5, 15);
            const result = apply(ctx, baseAcc());
            expect(result.serviceFee).toBe(0);
            expect(result.billableMinutes).toBe(0);
        });

        it("sets serviceFee = 0 and billableMinutes = 0 when duration == grace period (boundary)", () => {
            const ctx = makeCtx(15, 15);
            const result = apply(ctx, baseAcc());
            expect(result.serviceFee).toBe(0);
            expect(result.billableMinutes).toBe(0);
        });
    });

    describe("session exceeding grace period", () => {
        it("sets billableMinutes = totalMinutes - grace_period_minutes", () => {
            const ctx = makeCtx(30, 10);
            const result = apply(ctx, baseAcc());
            expect(result.billableMinutes).toBe(20);
        });

        it("does not zero out serviceFee when session exceeds grace period", () => {
            const ctx = makeCtx(60, 10);
            const result = apply(ctx, baseAcc({ serviceFee: 5000 }));
            expect(result.billableMinutes).toBe(50);
            // serviceFee is not touched by this rule when session exceeds grace period
            expect(result.serviceFee).toBe(5000);
        });
    });

    describe("grace_period_minutes = 0", () => {
        it("sets billableMinutes = totalMinutes (no reduction)", () => {
            const ctx = makeCtx(45, 0);
            const result = apply(ctx, baseAcc());
            expect(result.billableMinutes).toBe(45);
        });

        it("does not zero out serviceFee when grace period is 0", () => {
            const ctx = makeCtx(60, 0);
            const result = apply(ctx, baseAcc({ serviceFee: 10000 }));
            expect(result.billableMinutes).toBe(60);
            expect(result.serviceFee).toBe(10000);
        });
    });

    it("records gracePeriodMinutes on the accumulator", () => {
        const ctx = makeCtx(30, 10);
        const result = apply(ctx, baseAcc());
        expect(result.gracePeriodMinutes).toBe(10);
    });
});
