"use strict";

/**
 * Load, Performance & Disaster Test Orchestrator
 *
 * Prerequisites:
 * - Docker Compose running (postgres, minio, backend)
 * - Backend accessible at http://localhost:5000
 * - Seed data will be created automatically
 *
 * Usage: node load-tests/run-all.js
 */

const path = require("path");
const { CONFIG } = require("./config");
const { login } = require("./helpers/auth");
const { seed } = require("./helpers/seed");
const { cleanup } = require("./helpers/cleanup");
const { checkPreconditions } = require("./helpers/preconditions");
const { getMetadata } = require("./helpers/metadata");
const { writeJsonReport } = require("./reporters/json-reporter");
const { writeMarkdownReport } = require("./reporters/markdown-reporter");

const scenarios = [
    { name: "load", module: "./scenarios/load" },
    { name: "perf", module: "./scenarios/perf" },
    { name: "disaster-db", module: "./scenarios/disaster-db" },
    { name: "disaster-race", module: "./scenarios/disaster-race" },
    { name: "disaster-minio", module: "./scenarios/disaster-minio" },
];

async function runAll() {
    console.log("=== Load, Performance & Disaster Tests ===\n");

    // 1. Authenticate both roles
    console.log("[1/5] Authenticating...");
    let adminCookie, employeeCookie;
    try {
        adminCookie = await login(CONFIG.baseUrl, "admin", "admin123");
        console.log("  ✓ Admin logged in");
        employeeCookie = await login(CONFIG.baseUrl, "ninh1", "ninh1");
        console.log("  ✓ Employee logged in\n");
    } catch (err) {
        console.error(`  ✗ Auth failed: ${err.message}`);
        process.exit(1);
    }

    // 2. Check preconditions (use employee cookie for employee endpoints)
    console.log("[2/5] Checking preconditions...");
    try {
        await checkPreconditions(CONFIG.baseUrl, employeeCookie);
        console.log("  ✓ All endpoints reachable\n");
    } catch (err) {
        console.error(`  ✗ ${err.message}`);
        process.exit(1);
    }

    // 3. Seed data (admin creates lots/cards, employee does check-in)
    console.log("[3/5] Seeding test data...");
    let seedData;
    try {
        seedData = await seed(CONFIG.baseUrl, adminCookie, employeeCookie);
        console.log(`  ✓ Seed complete (lot=${seedData.lotId}, session=${seedData.sessionId})\n`);
    } catch (err) {
        console.error(`  ✗ Seed failed: ${err.message}`);
        process.exit(1);
    }

    // 4. Run scenarios sequentially
    console.log("[4/5] Running scenarios...\n");
    const ctx = {
        baseUrl: CONFIG.baseUrl,
        adminCookie,
        employeeCookie,
        authCookie: employeeCookie,  // default for scenarios
        outputDir: path.resolve(CONFIG.outputDir),
        config: CONFIG,
        seedData,
    };

    const results = [];
    for (const scenario of scenarios) {
        const start = Date.now();
        console.log(`  → ${scenario.name}...`);
        try {
            const mod = require(scenario.module);
            const result = await mod.run(ctx);
            const scenarioResults = Array.isArray(result) ? result : [result];
            for (const r of scenarioResults) {
                r.durationMs = r.durationMs || (Date.now() - start);
                results.push(r);
                console.log(`    ✓ ${r.name}: ${r.status}`);
            }
        } catch (err) {
            const durationMs = Date.now() - start;
            results.push({
                name: scenario.name,
                status: "FAIL",
                metrics: null,
                error: err.message,
                durationMs,
            });
            console.log(`    ✗ ${scenario.name}: FAIL — ${err.message}`);
        }
    }

    // 5. Generate reports
    console.log("\n[5/5] Generating reports...");
    const metadata = getMetadata();
    const outputDir = path.resolve(CONFIG.outputDir);
    writeJsonReport(results, metadata, outputDir);
    writeMarkdownReport(results, outputDir);
    console.log(`  ✓ Reports written to ${outputDir}\n`);

    // Cleanup
    try {
        await cleanup(CONFIG.baseUrl, adminCookie, seedData);
    } catch (_) {}

    // Exit code
    const hasFail = results.some((r) => r.status === "FAIL");
    const summary = `${results.filter(r => r.status === "PASS").length}/${results.length} passed`;
    console.log(`\n=== Done (${summary}) ===`);
    process.exit(hasFail ? 1 : 0);
}

runAll();
