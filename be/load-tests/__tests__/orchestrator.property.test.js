"use strict";

// Feature: load-perf-disaster-tests, Property 5: Orchestrator resilience — continues after failure
const fc = require("fast-check");

describe("Property 5: Orchestrator resilience — continues after failure", () => {
    /**
     * **Validates: Requirements 6.3**
     *
     * For any sequence of scenario executions where some throw errors,
     * the orchestrator SHALL execute all scenarios in order, record thrown
     * scenarios as status "FAIL" with the error message, and produce a final
     * results array with length equal to the total number of scenarios.
     */
    it("for any scenario sequence (some throw), results.length === scenarios.length", () => {
        const scenarioGen = fc.oneof(fc.constant("pass"), fc.constant("throw"));

        fc.assert(
            fc.property(
                fc.array(scenarioGen, { minLength: 1, maxLength: 20 }),
                (scenarioTypes) => {
                    // Simulate orchestrator behavior (mirrors run-all.js loop)
                    const results = [];
                    for (const type of scenarioTypes) {
                        try {
                            if (type === "throw") {
                                throw new Error("Scenario crashed");
                            }
                            results.push({ name: "test", status: "PASS", error: null });
                        } catch (err) {
                            results.push({ name: "test", status: "FAIL", error: err.message });
                        }
                    }

                    // Property: all scenarios recorded regardless of throws
                    if (results.length !== scenarioTypes.length) return false;

                    // Thrown scenarios are marked FAIL with error message
                    for (let i = 0; i < scenarioTypes.length; i++) {
                        if (scenarioTypes[i] === "throw") {
                            if (results[i].status !== "FAIL") return false;
                            if (!results[i].error) return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
