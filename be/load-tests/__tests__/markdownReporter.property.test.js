"use strict";

// Feature: load-perf-disaster-tests, Property 6: Markdown summary contains all scenario results
const fc = require("fast-check");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { writeMarkdownReport } = require("../reporters/markdown-reporter");

describe("Property 6: Markdown summary contains all scenario results", () => {
    const tmpDir = path.join(os.tmpdir(), "load-test-md-prop");

    afterEach(() => {
        try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    });

    it("for any ScenarioResult array, Markdown table has row per scenario", () => {
        const metricsGen = fc.record({
            p50: fc.integer({ min: 0, max: 10000 }),
            p95: fc.integer({ min: 0, max: 10000 }),
            errorRate: fc.float({ min: 0, max: 100 }),
            rps: fc.float({ min: 0, max: 50000 }),
        });

        const resultGen = fc.record({
            name: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
            status: fc.oneof(fc.constant("PASS"), fc.constant("FAIL")),
            metrics: fc.oneof(metricsGen, fc.constant(null)),
            error: fc.oneof(fc.string({ maxLength: 50 }), fc.constant(null)),
            durationMs: fc.integer({ min: 0, max: 300000 }),
        });

        fc.assert(
            fc.property(
                fc.array(resultGen, { minLength: 1, maxLength: 10 }),
                (results) => {
                    writeMarkdownReport(results, tmpDir);
                    const filePath = path.join(tmpDir, "REPORT.md");
                    const content = fs.readFileSync(filePath, "utf8");
                    const lines = content.split("\n");

                    // Find table rows (lines starting with |, excluding header and separator)
                    const separatorPattern = /^\|[-|\s]+$/;
                    const tableRows = lines.filter(
                        l => l.startsWith("|") && !separatorPattern.test(l) && !l.includes("| Name |")
                    );

                    // One row per scenario result
                    if (tableRows.length !== results.length) return false;

                    // Each row contains the scenario name
                    for (let i = 0; i < results.length; i++) {
                        if (!tableRows[i].includes(results[i].name)) return false;
                    }

                    return true;
                }
            ),
            { numRuns: 20 }
        );
    });
});
