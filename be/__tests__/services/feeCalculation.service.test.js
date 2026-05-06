jest.mock("../../repositories/feeConfig.repo", () => ({
    getActiveConfig: jest.fn(),
}));

const feeConfigRepo = require("../../repositories/feeConfig.repo");

describe("feeCalculation.service", () => {
    const baseSession = {
        time_in: "2026-03-28T00:00:00.000Z",
        service_fee: 10000,
        penalty_fee: 50000,
        is_monthly: false,
        is_lost: false,
        vehicle_type: "car",
    };

    const mockConfig = {
        hourly_rate: 10000,
        rounding_strategy: "ceil_hour",
        tiered_rate_enabled: false,
        daily_cap: null,
        grace_period_minutes: 0,
        penalty_fee: 50000,
        time_of_day_rates: [],
        tiered_rates: [],
    };

    beforeEach(() => {
        feeConfigRepo.getActiveConfig.mockResolvedValue(mockConfig);
    });

    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.MAX_PARKING_HOURS;
        delete process.env.MAX_PAYMENT_AMOUNT;
    });

    it("charges non-monthly sessions by rounded-up hours", async () => {
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = await calculateAndValidateFee(
            baseSession,
            new Date("2026-03-28T01:01:00.000Z")
        );

        expect(result.success).toBe(true);
        expect(result.billableHours).toBe(2);
        expect(result.serviceFee).toBe(20000);
        expect(result.penaltyFee).toBe(0);
        expect(result.totalAmount).toBe(20000);
    });

    it("monthly sessions do not pay service fee", async () => {
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = await calculateAndValidateFee(
            { ...baseSession, is_monthly: true },
            new Date("2026-03-28T05:00:00.000Z")
        );

        expect(result.success).toBe(true);
        expect(result.serviceFee).toBe(0);
        expect(result.totalAmount).toBe(0);
    });

    it("applies lost ticket penalty once", async () => {
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = await calculateAndValidateFee(
            { ...baseSession, is_lost: true },
            new Date("2026-03-28T01:00:00.000Z")
        );

        expect(result.success).toBe(true);
        expect(result.serviceFee).toBe(10000);
        expect(result.penaltyFee).toBe(50000);
        expect(result.totalAmount).toBe(60000);
    });

    it("fails when parking duration exceeds MAX_PARKING_HOURS", async () => {
        process.env.MAX_PARKING_HOURS = "1";
        // Re-require to pick up new env value for constants
        jest.resetModules();
        jest.mock("../../repositories/feeConfig.repo", () => ({
            getActiveConfig: jest.fn().mockResolvedValue(mockConfig),
        }));
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = await calculateAndValidateFee(
            baseSession,
            new Date("2026-03-28T03:00:00.000Z")
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Parking duration exceeds maximum allowed");
    });

    it("fails when amount exceeds MAX_PAYMENT_AMOUNT", async () => {
        process.env.MAX_PAYMENT_AMOUNT = "5000";
        jest.resetModules();
        jest.mock("../../repositories/feeConfig.repo", () => ({
            getActiveConfig: jest.fn().mockResolvedValue(mockConfig),
        }));
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = await calculateAndValidateFee(
            baseSession,
            new Date("2026-03-28T01:00:00.000Z")
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("exceeds maximum allowed");
    });
});
