// Feature: fee-calculation-engine
// Tests for dailyCap.rule.js
// Requirements: 5.1, 5.4, 5.5

"use strict";

const { apply } = require("../../rules/dailyCap.rule");

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

describe("dailyCap.rule", () => {
    it("returns accumulator unchanged when daily_cap_enabled = false", () => {
        const ctx = {
            config: { daily_cap_enabled: false, daily_cap_amount: 50000 },
            session: {
                time_in: new Date("2025-01-01T10:00:00Z"),
                time_out: new Date("2025-01-01T22:00:00Z"),
            },
        };
        const acc = baseAcc({ serviceFee: 120000 });
        const result = apply(ctx, acc);
        expect(result).toBe(acc);
        expect(result.serviceFee).toBe(120000);
        expect(result.dailyCapApplied).toBe(false);
    });

    it("leaves serviceFee unchanged and sets dailyCapApplied = false when fee is below cap", () => {
        const ctx = {
            config: { daily_cap_enabled: true, daily_cap_amount: 50000 },
            session: {
                time_in: new Date("2025-01-01T10:00:00Z"),
                time_out: new Date("2025-01-01T14:00:00Z"),
            },
        };
        const result = apply(ctx, baseAcc({ serviceFee: 30000 }));
        expect(result.serviceFee).toBe(30000);
        expect(result.dailyCapApplied).toBe(false);
    });

    it("caps serviceFee to daily_cap_amount and sets dailyCapApplied = true when fee exceeds cap", () => {
        const ctx = {
            config: { daily_cap_enabled: true, daily_cap_amount: 50000 },
            session: {
                time_in: new Date("2025-01-01T00:00:00Z"),
                time_out: new Date("2025-01-01T23:59:00Z"),
            },
        };
        const result = apply(ctx, baseAcc({ serviceFee: 200000 }));
        expect(result.serviceFee).toBe(50000);
        expect(result.dailyCapApplied).toBe(true);
    });

    it("applies cap per calendar day for a multi-day session spanning 2 days", () => {
        // 48-hour session: 2025-01-01 00:00 → 2025-01-03 00:00 (exactly 2 days)
        // serviceFee = 200000 total; each day gets 100000 which exceeds cap of 50000
        // Expected: 2 * 50000 = 100000
        const ctx = {
            config: { daily_cap_enabled: true, daily_cap_amount: 50000 },
            session: {
                time_in: new Date("2025-01-01T00:00:00Z"),
                time_out: new Date("2025-01-03T00:00:00Z"),
            },
        };
        const result = apply(ctx, baseAcc({ serviceFee: 200000 }));
        expect(result.serviceFee).toBe(100000);
        expect(result.dailyCapApplied).toBe(true);
    });

    it("sets dailyCapApplied = false when no day exceeds the cap in a multi-day session", () => {
        // 48-hour session, serviceFee = 40000 total; each day gets 20000 which is below cap of 50000
        const ctx = {
            config: { daily_cap_enabled: true, daily_cap_amount: 50000 },
            session: {
                time_in: new Date("2025-01-01T00:00:00Z"),
                time_out: new Date("2025-01-03T00:00:00Z"),
            },
        };
        const result = apply(ctx, baseAcc({ serviceFee: 40000 }));
        expect(result.serviceFee).toBe(40000);
        expect(result.dailyCapApplied).toBe(false);
    });
});
