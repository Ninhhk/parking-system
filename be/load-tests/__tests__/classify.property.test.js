"use strict";

// Feature: load-perf-disaster-tests, Property 2: Response classification correctness
const fc = require("fast-check");
const { classify } = require("../helpers/classify");

describe("Property 2: Response classification correctness", () => {
    it("200-499 → success, 500-599 → failure", () => {
        fc.assert(
            fc.property(fc.integer({ min: 100, max: 599 }), (code) => {
                const result = classify(code);
                if (code >= 200 && code <= 499) {
                    return result === "success";
                }
                return result === "failure";
            }),
            { numRuns: 100 }
        );
    });

    it("null/undefined (timeouts) → failure", () => {
        expect(classify(null)).toBe("failure");
        expect(classify(undefined)).toBe("failure");
    });
});
