// Feature: fee-calculation-engine
// Requirements: 1.1, 1.2, 1.5, 1.6

const { runPipeline, buildContext } = require("../../services/feeEngine.service");

const baseConfig = {
    config_version_id: 42,
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

const timeIn = new Date("2025-01-01T10:00:00Z");
const timeOut = new Date("2025-01-01T12:00:00Z"); // 2 hours

function makeCtx(overrides = {}) {
    const session = {
        session_id: 1,
        vehicle_type: "car",
        time_in: timeIn,
        is_lost: false,
        ...overrides,
    };
    return buildContext(session, baseConfig, timeOut);
}

describe("feeEngine.service", () => {
    describe("runPipeline", () => {
        it("monthly session skips SERVICE_FEE_RULES — serviceFee is 0", () => {
            const ctx = makeCtx({ is_lost: false });
            const breakdown = runPipeline(ctx, true);

            expect(breakdown.serviceFee).toBe(0);
            expect(breakdown.totalAmount).toBe(0);
        });

        it("monthly + lost session — penaltyFee applied, serviceFee still 0", () => {
            const ctx = makeCtx({ is_lost: true });
            const breakdown = runPipeline(ctx, true);

            expect(breakdown.serviceFee).toBe(0);
            expect(breakdown.penaltyFee).toBe(50000);
            expect(breakdown.totalAmount).toBe(50000);
        });

        it("non-monthly session runs full pipeline — 2-hour session at 10000/hr = 20000", () => {
            const ctx = makeCtx({ is_lost: false });
            const breakdown = runPipeline(ctx, false);

            expect(breakdown.serviceFee).toBe(20000);
            expect(breakdown.totalAmount).toBe(20000);
        });

        it("configVersionId is set from ctx.config.config_version_id", () => {
            const ctx = makeCtx();
            const breakdown = runPipeline(ctx, false);

            expect(breakdown.configVersionId).toBe(42);
        });

        it("totalAmount = serviceFee + penaltyFee for non-monthly + lost session", () => {
            const ctx = makeCtx({ is_lost: true });
            const breakdown = runPipeline(ctx, false);

            expect(breakdown.totalAmount).toBe(breakdown.serviceFee + breakdown.penaltyFee);
            expect(breakdown.totalAmount).toBe(20000 + 50000);
        });
    });

    describe("buildContext", () => {
        it("constructs a RuleContext with session and config", () => {
            const session = { session_id: 1, vehicle_type: "car", time_in: timeIn, is_lost: false };
            const ctx = buildContext(session, baseConfig, timeOut);

            expect(ctx.session.session_id).toBe(1);
            expect(ctx.session.time_out).toBe(timeOut);
            expect(ctx.config).toBe(baseConfig);
        });

        it("does not include is_monthly on the context session", () => {
            const session = { session_id: 1, vehicle_type: "car", time_in: timeIn, is_lost: false, is_monthly: true };
            const ctx = buildContext(session, baseConfig, timeOut);

            expect(ctx.session).not.toHaveProperty("is_monthly");
        });
    });
});
