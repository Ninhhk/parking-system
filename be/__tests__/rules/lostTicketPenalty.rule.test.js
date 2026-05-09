// Feature: fee-calculation-engine
// Tests for lostTicketPenalty.rule.js
// Requirements: 8.1, 8.3

"use strict";

const { apply } = require("../../rules/lostTicketPenalty.rule");

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

describe("lostTicketPenalty.rule", () => {
    it("leaves penaltyFee unchanged when is_lost = false", () => {
        const ctx = { session: { is_lost: false }, config: { penalty_fee: 50000 } };
        const result = apply(ctx, baseAcc());
        expect(result.penaltyFee).toBe(0);
    });

    it("adds config.penalty_fee to acc.penaltyFee when is_lost = true", () => {
        const ctx = { session: { is_lost: true }, config: { penalty_fee: 50000 } };
        const result = apply(ctx, baseAcc());
        expect(result.penaltyFee).toBe(50000);
    });

    it("leaves penaltyFee unchanged when penalty_fee = 0 and is_lost = true", () => {
        const ctx = { session: { is_lost: true }, config: { penalty_fee: 0 } };
        const result = apply(ctx, baseAcc());
        expect(result.penaltyFee).toBe(0);
    });

    it("adds penalty on top of existing penaltyFee when is_lost = true", () => {
        const ctx = { session: { is_lost: true }, config: { penalty_fee: 30000 } };
        const result = apply(ctx, baseAcc({ penaltyFee: 20000 }));
        expect(result.penaltyFee).toBe(50000);
    });

    it("returns accumulator unchanged (same reference) when is_lost = false", () => {
        const ctx = { session: { is_lost: false }, config: { penalty_fee: 50000 } };
        const acc = baseAcc();
        const result = apply(ctx, acc);
        expect(result).toBe(acc);
    });
});
