"use strict";

// Feature: load-perf-disaster-tests, Property 3: Error rate computation
const fc = require("fast-check");
const { computeErrorRate } = require("../helpers/classify");

describe("Property 3: Error rate computation", () => {
    it("errorRate = (failCount/total)*100, 0 <= rate <= 100", () => {
        const entry = fc.oneof(fc.constant("success"), fc.constant("failure"));

        fc.assert(
            fc.property(fc.array(entry, { minLength: 1, maxLength: 200 }), (results) => {
                const { errorCount, errorRate } = computeErrorRate(results);
                const failCount = results.filter(r => r === "failure").length;

                return (
                    errorCount === failCount &&
                    Math.abs(errorRate - (failCount / results.length) * 100) < 0.001 &&
                    errorRate >= 0 &&
                    errorRate <= 100
                );
            }),
            { numRuns: 100 }
        );
    });

    it("empty array returns 0", () => {
        const { errorCount, errorRate } = computeErrorRate([]);
        expect(errorCount).toBe(0);
        expect(errorRate).toBe(0);
    });
});
