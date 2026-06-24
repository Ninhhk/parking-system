"use strict";

// Feature: load-perf-disaster-tests, Property 1: Report generation produces valid JSON with all required fields
const fc = require("fast-check");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { writeJsonReport } = require("../reporters/json-reporter");

describe("Property 1: Report generation produces valid JSON with all required fields", () => {
    const tmpDir = path.join(os.tmpdir(), "load-test-json-prop");

    afterEach(() => {
        try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    });

    it("for any valid result, output contains all required fields", () => {
        const metricsGen = fc.record({
            endpoint: fc.string({ minLength: 1 }),
            concurrency: fc.integer({ min: 1, max: 200 }),
            duration: fc.integer({ min: 1, max: 60 }),
            totalRequests: fc.integer({ min: 0, max: 100000 }),
            successCount: fc.integer({ min: 0, max: 100000 }),
            errorCount: fc.integer({ min: 0, max: 100000 }),
            errorRate: fc.float({ min: 0, max: 100 }),
            p50: fc.integer({ min: 0, max: 10000 }),
            p95: fc.integer({ min: 0, max: 10000 }),
            rps: fc.float({ min: 0, max: 50000 }),
        });

        const resultGen = fc.record({
            name: fc.string({ minLength: 1 }),
            status: fc.oneof(fc.constant("PASS"), fc.constant("FAIL")),
            metrics: fc.oneof(metricsGen, fc.constant(null)),
            error: fc.oneof(fc.string(), fc.constant(null)),
            durationMs: fc.integer({ min: 0, max: 300000 }),
        });

        const metadataGen = fc.record({
            timestamp: fc.constant(new Date().toISOString()),
            cpu: fc.string({ minLength: 1 }),
            ramGB: fc.integer({ min: 1, max: 128 }),
            os: fc.string({ minLength: 1 }),
            nodeVersion: fc.constant(process.version),
            dbPoolMax: fc.constant(20),
        });

        fc.assert(
            fc.property(
                fc.array(resultGen, { minLength: 1, maxLength: 10 }),
                metadataGen,
                (results, metadata) => {
                    writeJsonReport(results, metadata, tmpDir);
                    const filePath = path.join(tmpDir, "load-test-results.json");
                    const content = fs.readFileSync(filePath, "utf8");
                    const parsed = JSON.parse(content);

                    // Required metadata fields
                    if (!parsed.metadata) return false;
                    if (!parsed.metadata.timestamp) return false;
                    if (!parsed.metadata.cpu) return false;
                    if (typeof parsed.metadata.ramGB !== "number") return false;
                    if (!parsed.metadata.os) return false;
                    if (!parsed.metadata.nodeVersion) return false;
                    if (typeof parsed.metadata.dbPoolMax !== "number") return false;

                    // Results array matches
                    if (!Array.isArray(parsed.results)) return false;
                    if (parsed.results.length !== results.length) return false;

                    return true;
                }
            ),
            { numRuns: 20 }
        );
    });
});
