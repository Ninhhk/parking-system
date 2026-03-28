describe("feeCalculation.service", () => {
    const baseSession = {
        time_in: "2026-03-28T00:00:00.000Z",
        service_fee: 10000,
        penalty_fee: 50000,
        is_monthly: false,
        is_lost: false,
    };

    afterEach(() => {
        jest.resetModules();
        delete process.env.MAX_PARKING_HOURS;
        delete process.env.MAX_PAYMENT_AMOUNT;
    });

    it("charges non-monthly sessions by rounded-up hours", () => {
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = calculateAndValidateFee(
            baseSession,
            new Date("2026-03-28T01:01:00.000Z")
        );

        expect(result.success).toBe(true);
        expect(result.hours).toBe(2);
        expect(result.serviceFee).toBe(20000);
        expect(result.penaltyFee).toBe(0);
        expect(result.totalAmount).toBe(20000);
    });

    it("monthly sessions do not pay service fee", () => {
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = calculateAndValidateFee(
            { ...baseSession, is_monthly: true },
            new Date("2026-03-28T05:00:00.000Z")
        );

        expect(result.success).toBe(true);
        expect(result.serviceFee).toBe(0);
        expect(result.totalAmount).toBe(0);
    });

    it("applies lost ticket penalty once", () => {
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = calculateAndValidateFee(
            { ...baseSession, is_lost: true },
            new Date("2026-03-28T01:00:00.000Z")
        );

        expect(result.success).toBe(true);
        expect(result.serviceFee).toBe(10000);
        expect(result.penaltyFee).toBe(50000);
        expect(result.totalAmount).toBe(60000);
    });

    it("fails when parking duration exceeds MAX_PARKING_HOURS", () => {
        process.env.MAX_PARKING_HOURS = "1";
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = calculateAndValidateFee(
            baseSession,
            new Date("2026-03-28T03:00:00.000Z")
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("Parking duration exceeds maximum allowed");
    });

    it("fails when amount exceeds MAX_PAYMENT_AMOUNT", () => {
        process.env.MAX_PAYMENT_AMOUNT = "5000";
        const { calculateAndValidateFee } = require("../../services/feeCalculation.service");

        const result = calculateAndValidateFee(
            baseSession,
            new Date("2026-03-28T01:00:00.000Z")
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain("exceeds maximum allowed");
    });
});
