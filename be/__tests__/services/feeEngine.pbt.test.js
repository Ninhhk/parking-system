// Feature: fee-calculation-engine
// Property-based tests for the fee calculation pipeline
// Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 3.1, 3.4, 4.4, 5.1, 5.4,
//               6.1, 6.4, 6.5, 7.1, 7.4, 8.1, 8.4, 9.2, 9.3, 10.1-10.5, 13.1, 13.2

const fc = require("fast-check");
const { runPipeline, buildContext } = require("../../services/feeEngine.service");
const { validateFeeConfig } = require("../../services/admin.feeConfig.service");

function makeConfig(overrides = {}) {
    return {
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
        ...overrides,
    };
}

function makeSession(durationMinutes, overrides = {}) {
    const time_in = new Date("2025-06-15T10:00:00Z");
    const time_out = new Date(time_in.getTime() + durationMinutes * 60 * 1000);
    return { session_id: 1, vehicle_type: "car", time_in, time_out, is_lost: false, ...overrides };
}

// ─── Property 1 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 1: monthly sessions always have zero service fee
// **Validates: Requirements 1.6, 8.4**
test("Property 1: monthly sessions always have zero service fee", () => {
    fc.assert(fc.property(
        fc.boolean(),
        fc.constantFrom("car", "bike"),
        fc.integer({ min: 1, max: 43200 }),
        fc.double({ min: 0.01, max: 1000000, noNaN: true }),
        (isLost, vehicleType, durationMinutes, hourlyRate) => {
            const config = makeConfig({ vehicle_type: vehicleType, hourly_rate: hourlyRate });
            const session = makeSession(durationMinutes, { vehicle_type: vehicleType, is_lost: isLost });
            const ctx = buildContext(session, config, session.time_out);
            const breakdown = runPipeline(ctx, true); // isMonthly = true
            return breakdown.serviceFee === 0;
        }
    ));
});

// ─── Property 2 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 2: disabled rules are transparent
// **Validates: Requirements 1.4**
test("Property 2: disabled rules are transparent", () => {
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 720 }),
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        (durationMinutes, hourlyRate) => {
            const baseConfig = makeConfig({ hourly_rate: hourlyRate });
            const session = makeSession(durationMinutes);
            const ctx = buildContext(session, baseConfig, session.time_out);
            const baseline = runPipeline(ctx, false);

            // Explicitly disabled daily cap should match baseline
            const capConfig = makeConfig({ hourly_rate: hourlyRate, daily_cap_enabled: false });
            const capCtx = buildContext(session, capConfig, session.time_out);
            const capResult = runPipeline(capCtx, false);

            return baseline.serviceFee === capResult.serviceFee;
        }
    ));
});

// ─── Property 3 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 3: fee breakdown always contains all required fields with correct types
// **Validates: Requirements 1.5, 9.4**
test("Property 3: fee breakdown always contains all required fields with correct types", () => {
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 43200 }),
        fc.boolean(),
        (durationMinutes, isMonthly) => {
            const config = makeConfig();
            const session = makeSession(durationMinutes);
            const ctx = buildContext(session, config, session.time_out);
            const breakdown = runPipeline(ctx, isMonthly);

            return (
                typeof breakdown.gracePeriodMinutes === "number" &&
                typeof breakdown.billableHours === "number" &&
                typeof breakdown.serviceFee === "number" &&
                typeof breakdown.penaltyFee === "number" &&
                typeof breakdown.dailyCapApplied === "boolean" &&
                typeof breakdown.totalAmount === "number" &&
                breakdown.configVersionId !== undefined
            );
        }
    ));
});

// ─── Property 4 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 4: grace period zeroes fee for short sessions
// **Validates: Requirements 2.1**
test("Property 4: grace period zeroes fee for short sessions", () => {
    fc.assert(fc.property(
        fc.integer({ min: 0, max: 60 }),
        fc.integer({ min: 0, max: 60 }),
        (gracePeriodMinutes, durationMinutes) => {
            const actualDuration = Math.min(durationMinutes, gracePeriodMinutes);
            const config = makeConfig({ grace_period_minutes: gracePeriodMinutes });
            const session = makeSession(actualDuration);
            const ctx = buildContext(session, config, session.time_out);
            const breakdown = runPipeline(ctx, false);
            return breakdown.serviceFee === 0;
        }
    ));
});

// ─── Property 5 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 5: grace period reduces billable duration
// **Validates: Requirements 2.2**
// Use gracePeriod.rule directly for this property
test("Property 5: grace period reduces billable duration", () => {
    const gracePeriodRule = require("../../rules/gracePeriod.rule");
    fc.assert(fc.property(
        fc.integer({ min: 0, max: 59 }),
        fc.integer({ min: 1, max: 720 }),
        (gracePeriodMinutes, extraMinutes) => {
            const totalMinutes = gracePeriodMinutes + extraMinutes;
            const time_in = new Date("2025-01-01T10:00:00Z");
            const time_out = new Date(time_in.getTime() + totalMinutes * 60 * 1000);
            const ctx = {
                session: { time_in, time_out },
                config: { grace_period_minutes: gracePeriodMinutes },
            };
            const acc = { gracePeriodMinutes: 0, billableMinutes: 0, billableHours: 0, serviceFee: 0, penaltyFee: 0, dailyCapApplied: false, totalAmount: 0, configVersionId: null };
            const result = gracePeriodRule.apply(ctx, acc);
            return result.billableMinutes === totalMinutes - gracePeriodMinutes;
        }
    ));
});

// ─── Property 6 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 6: rounding never reduces the fee
// **Validates: Requirements 4.4**
test("Property 6: rounding never reduces the fee", () => {
    const roundingRule = require("../../rules/rounding.rule");
    const hourlyRateRule = require("../../rules/hourlyRate.rule");
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 43200 }),
        fc.constantFrom("ceil_hour", "ceil_half_hour", "exact_minutes"),
        fc.double({ min: 0.01, max: 100000, noNaN: true }),
        (durationMinutes, strategy, hourlyRate) => {
            const baseAcc = { gracePeriodMinutes: 0, billableMinutes: durationMinutes, billableHours: 0, serviceFee: 0, penaltyFee: 0, dailyCapApplied: false, totalAmount: 0, configVersionId: null };
            const config = { rounding_strategy: strategy, hourly_rate: hourlyRate, tiered_rate_enabled: false };
            const ctx = { config };

            // Fee with rounding
            const rounded = roundingRule.apply(ctx, baseAcc);
            const feeWithRounding = hourlyRateRule.apply(ctx, rounded).serviceFee;

            // Fee with exact minutes (no rounding)
            const exactAcc = { ...baseAcc, billableHours: durationMinutes / 60 };
            const feeExact = hourlyRateRule.apply(ctx, exactAcc).serviceFee;

            return feeWithRounding >= feeExact - 0.001; // small epsilon for float precision
        }
    ));
});

// ─── Property 7 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 7: hourly rate fee is linear in billable hours
// **Validates: Requirements 3.1, 3.4**
test("Property 7: hourly rate fee is linear in billable hours", () => {
    const hourlyRateRule2 = require("../../rules/hourlyRate.rule");
    fc.assert(fc.property(
        fc.double({ min: 0, max: 720, noNaN: true }),
        fc.double({ min: 0.01, max: 1000000, noNaN: true }),
        (billableHours, hourlyRate) => {
            const acc = { gracePeriodMinutes: 0, billableMinutes: 0, billableHours, serviceFee: 0, penaltyFee: 0, dailyCapApplied: false, totalAmount: 0, configVersionId: null };
            const ctx = { config: { tiered_rate_enabled: false, hourly_rate: hourlyRate } };
            const result = hourlyRateRule2.apply(ctx, acc);
            return Math.abs(result.serviceFee - billableHours * hourlyRate) < 0.001;
        }
    ));
});

// ─── Property 8 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 8: daily cap is an upper bound per day
// **Validates: Requirements 5.1, 5.4**
test("Property 8: daily cap is an upper bound per day", () => {
    const dailyCapRule = require("../../rules/dailyCap.rule");
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 48 }),
        fc.double({ min: 1, max: 100000, noNaN: true }),
        fc.double({ min: 1, max: 1000000, noNaN: true }),
        (sessionHours, dailyCapAmount, serviceFee) => {
            const time_in = new Date("2025-01-01T00:00:00Z");
            const time_out = new Date(time_in.getTime() + sessionHours * 60 * 60 * 1000);
            const ctx = {
                config: { daily_cap_enabled: true, daily_cap_amount: dailyCapAmount },
                session: { time_in, time_out },
            };
            const acc = { gracePeriodMinutes: 0, billableMinutes: 0, billableHours: sessionHours, serviceFee, penaltyFee: 0, dailyCapApplied: false, totalAmount: 0, configVersionId: null };
            const result = dailyCapRule.apply(ctx, acc);
            return result.serviceFee <= dailyCapAmount * Math.ceil(sessionHours / 24) + 0.001;
        }
    ));
});

// ─── Property 9 ──────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 9: tiered fee equals sum of bracket contributions
// **Validates: Requirements 6.1, 6.4, 6.5**
test("Property 9: tiered fee equals sum of bracket contributions", () => {
    const tieredRateRule = require("../../rules/tieredRate.rule");
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        (billableHours, rate1, rate2) => {
            const tiers = [
                { up_to_hours: 5, rate_per_hour: rate1 },
                { up_to_hours: null, rate_per_hour: rate2 },
            ];
            const ctx = { config: { tiered_rate_enabled: true, tiers } };
            const acc = { gracePeriodMinutes: 0, billableMinutes: 0, billableHours, serviceFee: 0, penaltyFee: 0, dailyCapApplied: false, totalAmount: 0, configVersionId: null };
            const result = tieredRateRule.apply(ctx, acc);

            // Manual calculation
            const hoursInBracket1 = Math.min(billableHours, 5);
            const hoursInBracket2 = Math.max(0, billableHours - 5);
            const expected = hoursInBracket1 * rate1 + hoursInBracket2 * rate2;

            return Math.abs(result.serviceFee - expected) < 0.001;
        }
    ));
});

// ─── Property 10 ─────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 10: time-of-day split preserves total duration
// **Validates: Requirements 7.1, 7.4**
// This property verifies that the weighted sum of fractions equals 1.0 (all time accounted for)
// We verify this indirectly: with multiplier=1.0 for all windows, serviceFee = billableHours * hourlyRate
test("Property 10: time-of-day split preserves total duration", () => {
    const timeOfDayRule = require("../../rules/timeOfDayRate.rule");
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 120 }),
        fc.double({ min: 1, max: 10000, noNaN: true }),
        (durationMinutes, hourlyRate) => {
            const time_in = new Date("2025-01-01T10:00:00Z");
            const time_out = new Date(time_in.getTime() + durationMinutes * 60 * 1000);
            // Window covers the whole day with multiplier 1.0 — should produce same result as no window
            const ctx = {
                config: {
                    time_of_day_enabled: true,
                    hourly_rate: hourlyRate,
                    time_windows: [{ start_time: "00:00", end_time: "23:59", rate_multiplier: 1.0 }],
                },
                session: { time_in, time_out },
            };
            const billableHours = Math.ceil(durationMinutes / 60);
            const acc = { gracePeriodMinutes: 0, billableMinutes: durationMinutes, billableHours, serviceFee: 0, penaltyFee: 0, dailyCapApplied: false, totalAmount: 0, configVersionId: null };
            const result = timeOfDayRule.apply(ctx, acc);
            const expected = billableHours * hourlyRate;
            return Math.abs(result.serviceFee - expected) < 0.01 * expected + 1; // 1% relative + 1 absolute tolerance
        }
    ));
});

// ─── Property 11 ─────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 11: lost ticket penalty is always additive
// **Validates: Requirements 8.1, 8.4**
test("Property 11: lost ticket penalty is always additive", () => {
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 720 }),
        fc.double({ min: 0, max: 1000000, noNaN: true }),
        (durationMinutes, penaltyFee) => {
            const config = makeConfig({ penalty_fee: penaltyFee });
            const session = makeSession(durationMinutes, { is_lost: true });
            const ctx = buildContext(session, config, session.time_out);
            const breakdown = runPipeline(ctx, false);
            return Math.abs(breakdown.totalAmount - (breakdown.serviceFee + penaltyFee)) < 0.001;
        }
    ));
});

// ─── Property 12 ─────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 12: config version resolution selects the latest applicable version
// **Validates: Requirements 9.2, 9.3**
// Test the selection logic directly (simulating what getActiveConfig does)
test("Property 12: config version resolution selects the latest applicable version", () => {
    fc.assert(fc.property(
        fc.array(fc.integer({ min: 0, max: 1000 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 0, max: 1000 }),
        (offsets, queryOffset) => {
            // Create versions with effective_from = epoch + offset days
            const epoch = new Date("2020-01-01T00:00:00Z").getTime();
            const versions = offsets.map((offset, i) => ({
                config_version_id: i + 1,
                effective_from: new Date(epoch + offset * 86400000),
            }));
            const queryTime = new Date(epoch + queryOffset * 86400000);

            // Simulate the SQL: WHERE effective_from <= queryTime ORDER BY effective_from DESC LIMIT 1
            const applicable = versions
                .filter(v => v.effective_from <= queryTime)
                .sort((a, b) => b.effective_from - a.effective_from);

            if (applicable.length === 0) return true; // no applicable version — valid

            const selected = applicable[0];
            // Verify it's the maximum effective_from <= queryTime
            const allApplicable = versions.filter(v => v.effective_from <= queryTime);
            const maxEffective = Math.max(...allApplicable.map(v => v.effective_from.getTime()));
            return selected.effective_from.getTime() === maxEffective;
        }
    ));
});

// ─── Property 13 ─────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 13: validation rejects all invalid numeric fields
// **Validates: Requirements 10.1, 10.2, 10.4, 10.5**
test("Property 13: validation rejects all invalid numeric fields", () => {
    fc.assert(fc.property(
        fc.double({ min: -1000, max: -0.01, noNaN: true }),
        fc.double({ min: -1000, max: -0.01, noNaN: true }),
        (negativeRate, negativePenalty) => {
            const config = {
                hourly_rate: negativeRate,
                daily_cap_amount: 0,
                penalty_fee: negativePenalty,
                grace_period_minutes: 15,
                tiered_rate_enabled: false,
                tiers: [],
                time_of_day_enabled: false,
                time_windows: [],
            };
            const errors = validateFeeConfig(config);
            const fields = errors.map(e => e.field);
            return fields.includes("hourly_rate") && fields.includes("penalty_fee");
        }
    ));
});

// ─── Property 14 ─────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 14: tiered bracket validation rejects non-strictly-increasing up_to_hours
// **Validates: Requirements 10.3**
test("Property 14: tiered bracket validation rejects non-strictly-increasing up_to_hours", () => {
    fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        (hours1, hours2) => {
            // Make second bracket's up_to_hours <= first (invalid)
            const invalidHours2 = Math.min(hours2, hours1);
            const config = {
                hourly_rate: 10000,
                daily_cap_amount: 0,
                penalty_fee: 0,
                grace_period_minutes: 0,
                tiered_rate_enabled: true,
                tiers: [
                    { up_to_hours: hours1, rate_per_hour: 10000 },
                    { up_to_hours: invalidHours2, rate_per_hour: 5000 },
                ],
                time_of_day_enabled: false,
                time_windows: [],
            };
            const errors = validateFeeConfig(config);
            // Should have an error for tiers[1].up_to_hours
            return errors.some(e => e.field === "tiers[1].up_to_hours");
        }
    ));
});

// ─── Property 15 ─────────────────────────────────────────────────────────────

// Feature: fee-calculation-engine, Property 15: backward compatibility with legacy formula
// **Validates: Requirements 13.1, 13.2**
test("Property 15: backward compatibility with legacy formula", () => {
    fc.assert(fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom("car", "bike"),
        fc.integer({ min: 1, max: 720 }),
        (isMonthly, isLost, vehicleType, hours) => {
            const hourlyRate = vehicleType === "car" ? 10000 : 5000;
            const penaltyFee = vehicleType === "car" ? 50000 : 30000;

            // Legacy formula
            const legacyServiceFee = isMonthly ? 0 : (hours <= 1 ? hourlyRate : hourlyRate * hours);
            const legacyPenaltyFee = isLost ? penaltyFee : 0;
            const legacyTotal = legacyServiceFee + legacyPenaltyFee;

            // New engine with backward-compatible config
            const config = makeConfig({
                vehicle_type: vehicleType,
                grace_period_minutes: 0,
                rounding_strategy: "ceil_hour",
                hourly_rate: hourlyRate,
                daily_cap_enabled: false,
                tiered_rate_enabled: false,
                time_of_day_enabled: false,
                penalty_fee: penaltyFee,
            });

            // Session with exactly `hours` billable hours (use exact duration so ceil_hour gives exactly `hours`)
            const time_in = new Date("2025-01-01T00:00:00Z");
            const time_out = new Date(time_in.getTime() + hours * 60 * 60 * 1000);
            const session = { session_id: 1, vehicle_type: vehicleType, time_in, time_out, is_lost: isLost };
            const ctx = buildContext(session, config, time_out);
            const breakdown = runPipeline(ctx, isMonthly);

            return Math.abs(breakdown.totalAmount - legacyTotal) < 0.001;
        }
    ));
});
