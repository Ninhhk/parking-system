// Feature: fee-calculation-engine
// Requirements: 10.1–10.5

const { validateFeeConfig } = require("../../services/admin.feeConfig.service");

const validConfig = {
    hourly_rate: 10000,
    daily_cap_amount: 50000,
    penalty_fee: 30000,
    grace_period_minutes: 15,
    tiered_rate_enabled: false,
    tiers: [],
    time_of_day_enabled: false,
    time_windows: [],
};

describe("validateFeeConfig", () => {
    it("valid config returns empty errors array", () => {
        expect(validateFeeConfig(validConfig)).toEqual([]);
    });

    it("hourly_rate < 0 returns error for field 'hourly_rate'", () => {
        const errors = validateFeeConfig({ ...validConfig, hourly_rate: -1 });
        expect(errors.some(e => e.field === "hourly_rate")).toBe(true);
    });

    it("daily_cap_amount < 0 returns error for field 'daily_cap_amount'", () => {
        const errors = validateFeeConfig({ ...validConfig, daily_cap_amount: -1 });
        expect(errors.some(e => e.field === "daily_cap_amount")).toBe(true);
    });

    it("penalty_fee < 0 returns error for field 'penalty_fee'", () => {
        const errors = validateFeeConfig({ ...validConfig, penalty_fee: -1 });
        expect(errors.some(e => e.field === "penalty_fee")).toBe(true);
    });

    it("grace_period_minutes = -1 returns error for field 'grace_period_minutes'", () => {
        const errors = validateFeeConfig({ ...validConfig, grace_period_minutes: -1 });
        expect(errors.some(e => e.field === "grace_period_minutes")).toBe(true);
    });

    it("grace_period_minutes = 61 returns error for field 'grace_period_minutes'", () => {
        const errors = validateFeeConfig({ ...validConfig, grace_period_minutes: 61 });
        expect(errors.some(e => e.field === "grace_period_minutes")).toBe(true);
    });

    it("grace_period_minutes = 0 is valid (lower boundary)", () => {
        const errors = validateFeeConfig({ ...validConfig, grace_period_minutes: 0 });
        expect(errors.some(e => e.field === "grace_period_minutes")).toBe(false);
    });

    it("grace_period_minutes = 60 is valid (upper boundary)", () => {
        const errors = validateFeeConfig({ ...validConfig, grace_period_minutes: 60 });
        expect(errors.some(e => e.field === "grace_period_minutes")).toBe(false);
    });

    it("non-strictly-increasing tiers when tiered_rate_enabled returns error for offending bracket", () => {
        const config = {
            ...validConfig,
            tiered_rate_enabled: true,
            tiers: [
                { up_to_hours: 2, rate_per_hour: 10000 },
                { up_to_hours: 1, rate_per_hour: 5000 },
            ],
        };
        const errors = validateFeeConfig(config);
        expect(errors.some(e => e.field === "tiers[1].up_to_hours")).toBe(true);
    });

    it("rate_multiplier <= 0 when time_of_day_enabled returns error for offending window", () => {
        const config = {
            ...validConfig,
            time_of_day_enabled: true,
            time_windows: [{ start: "22:00", end: "06:00", rate_multiplier: 0 }],
        };
        const errors = validateFeeConfig(config);
        expect(errors.some(e => e.field === "time_windows[0].rate_multiplier")).toBe(true);
    });

    it("multiple invalid fields returns multiple errors naming each field", () => {
        const config = {
            ...validConfig,
            hourly_rate: -1,
            penalty_fee: -5,
            grace_period_minutes: 99,
        };
        const errors = validateFeeConfig(config);
        const fields = errors.map(e => e.field);
        expect(fields).toContain("hourly_rate");
        expect(fields).toContain("penalty_fee");
        expect(fields).toContain("grace_period_minutes");
    });
});
