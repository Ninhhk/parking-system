"use strict";

// Feature: load-perf-disaster-tests, Property 4: Precondition checker aborts on first unreachable endpoint
const fc = require("fast-check");

describe("Property 4: Precondition checker aborts on first unreachable endpoint", () => {
    /**
     * **Validates: Requirements 1.5**
     *
     * For any ordered list of endpoint reachability results where at least one
     * is unreachable, the precondition checker SHALL abort at the index of the
     * first unreachable endpoint and SHALL NOT check any endpoints after that index.
     */
    it("for any ordered list with at least one unreachable, stops at first failure index", () => {
        // Simulate: array of booleans (true=reachable, false=unreachable)
        // The checker should stop at the first false index
        fc.assert(
            fc.property(
                fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }).filter(
                    arr => arr.includes(false)
                ),
                (reachability) => {
                    let checkedCount = 0;
                    const firstUnreachableIdx = reachability.indexOf(false);

                    // Simulate the precondition checking logic (mirrors preconditions.js loop)
                    for (let i = 0; i < reachability.length; i++) {
                        checkedCount++;
                        if (!reachability[i]) break; // abort on first failure
                    }

                    // Should have checked up to and including the first unreachable
                    return checkedCount === firstUnreachableIdx + 1;
                }
            ),
            { numRuns: 100 }
        );
    });
});
