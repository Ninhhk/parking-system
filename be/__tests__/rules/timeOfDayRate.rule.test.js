// Feature: fee-calculation-engine
// Tests for timeOfDayRate.rule.js
// Requirements: 7.1, 7.4, 7.5

"use strict";

const { apply } = require("../../rules/timeOfDayRate.rule");

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

describe("timeOfDayRate.rule", () => {
    it("returns accumulator unchanged when time_of_day_enabled = false", () => {
        const ctx = {
            config: { time_of_day_enabled: false, time_windows: [], hourly_rate: 10000 },
            session: {
                time_in: new Date("2025-01-01T10:00:00Z"),
                time_out: new Date("2025-01-01T12:00:00Z"),
            },
        };
        const acc = baseAcc({ billableHours: 2, serviceFee: 20000 });
        const result = apply(ctx, acc);
        expect(result).toBe(acc);
        expect(result.serviceFee).toBe(20000);
    });

    it("applies multiplier when session is fully inside one window", () => {
        // Session: 10:00–12:00 UTC (2 hours), window 08:00–18:00 with multiplier 2.0
        // Expected: 2h * 10000 * 2.0 = 40000
        const ctx = {
            config: {
                time_of_day_enabled: true,
                hourly_rate: 10000,
                time_windows: [{ start_time: "08:00", end_time: "18:00", rate_multiplier: 2.0 }],
            },
            session: {
                time_in: new Date("2025-01-01T10:00:00Z"),
                time_out: new Date("2025-01-01T12:00:00Z"),
            },
        };
        const result = apply(ctx, baseAcc({ billableHours: 2 }));
        expect(result.serviceFee).toBe(40000);
    });

    it("applies multiplier 1.0 when session is fully outside all windows", () => {
        // Session: 10:00–12:00 UTC (2 hours), window 20:00–22:00 (no overlap)
        // Expected: 2h * 10000 * 1.0 = 20000
        const ctx = {
            config: {
                time_of_day_enabled: true,
                hourly_rate: 10000,
                time_windows: [{ start_time: "20:00", end_time: "22:00", rate_multiplier: 3.0 }],
            },
            session: {
                time_in: new Date("2025-01-01T10:00:00Z"),
                time_out: new Date("2025-01-01T12:00:00Z"),
            },
        };
        const result = apply(ctx, baseAcc({ billableHours: 2 }));
        expect(result.serviceFee).toBe(20000);
    });

    it("correctly splits a session crossing a midnight window (22:00–06:00)", () => {
        // Session: 23:00–01:00 UTC (2 hours), window 22:00–06:00 with multiplier 2.0
        // All 2 hours fall inside the midnight window
        // Expected: 2h * 10000 * 2.0 = 40000
        const ctx = {
            config: {
                time_of_day_enabled: true,
                hourly_rate: 10000,
                time_windows: [{ start_time: "22:00", end_time: "06:00", rate_multiplier: 2.0 }],
            },
            session: {
                time_in: new Date("2025-01-01T23:00:00Z"),
                time_out: new Date("2025-01-02T01:00:00Z"),
            },
        };
        // 2 billable hours, all inside the midnight window
        const result = apply(ctx, baseAcc({ billableHours: 2 }));
        expect(result.serviceFee).toBe(40000);
    });

    it("splits session partially inside and partially outside a window", () => {
        // Session: 17:00–19:00 UTC (2 hours), window 18:00–20:00 with multiplier 2.0
        // 1 hour outside (17:00–18:00) at 1.0, 1 hour inside (18:00–19:00) at 2.0
        // Expected: (0.5 * 2 * 10000 * 1.0) + (0.5 * 2 * 10000 * 2.0) = 10000 + 20000 = 30000
        const ctx = {
            config: {
                time_of_day_enabled: true,
                hourly_rate: 10000,
                time_windows: [{ start_time: "18:00", end_time: "20:00", rate_multiplier: 2.0 }],
            },
            session: {
                time_in: new Date("2025-01-01T17:00:00Z"),
                time_out: new Date("2025-01-01T19:00:00Z"),
            },
        };
        const result = apply(ctx, baseAcc({ billableHours: 2 }));
        expect(result.serviceFee).toBe(30000);
    });
});
