"use strict";

const { classify, computeErrorRate } = require("../helpers/classify");

describe("classify", () => {
    it("returns 'success' for 200-499", () => {
        expect(classify(200)).toBe("success");
        expect(classify(301)).toBe("success");
        expect(classify(404)).toBe("success");
        expect(classify(499)).toBe("success");
    });

    it("returns 'failure' for 500-599", () => {
        expect(classify(500)).toBe("failure");
        expect(classify(503)).toBe("failure");
        expect(classify(599)).toBe("failure");
    });

    it("returns 'failure' for undefined/null (timeouts)", () => {
        expect(classify(undefined)).toBe("failure");
        expect(classify(null)).toBe("failure");
    });

    it("returns 'failure' for codes outside 200-599", () => {
        expect(classify(100)).toBe("failure");
        expect(classify(199)).toBe("failure");
        expect(classify(600)).toBe("failure");
    });
});

describe("computeErrorRate", () => {
    it("returns 0 for empty array", () => {
        expect(computeErrorRate([])).toEqual({ errorCount: 0, errorRate: 0 });
    });

    it("returns 0 for all success", () => {
        const results = ["success", "success", "success"];
        expect(computeErrorRate(results)).toEqual({ errorCount: 0, errorRate: 0 });
    });

    it("returns 100 for all failure", () => {
        const results = ["failure", "failure"];
        expect(computeErrorRate(results)).toEqual({ errorCount: 2, errorRate: 100 });
    });

    it("computes correct rate for mixed results", () => {
        const results = ["success", "failure", "success", "failure", "success"];
        expect(computeErrorRate(results)).toEqual({ errorCount: 2, errorRate: 40 });
    });

    it("handles null/undefined input gracefully", () => {
        expect(computeErrorRate(null)).toEqual({ errorCount: 0, errorRate: 0 });
        expect(computeErrorRate(undefined)).toEqual({ errorCount: 0, errorRate: 0 });
    });
});
