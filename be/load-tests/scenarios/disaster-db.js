"use strict";

const { stopService, startService } = require("../helpers/docker");
const http = require("http");
const { CONFIG } = require("../config");

function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const payload = options.body || null;
        const headers = { ...options.headers };
        if (payload) {
            headers["Content-Type"] = "application/json";
            headers["Content-Length"] = Buffer.byteLength(payload);
        }
        const req = http.request({
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname,
            method: options.method || "POST",
            headers,
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => resolve({ statusCode: res.statusCode, body: data }));
        });
        req.setTimeout(options.timeout || CONFIG.timeouts.responseTimeout, () => {
            req.destroy(new Error("timeout"));
        });
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function waitForRecovery(baseUrl, authCookie, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await httpRequest(`${baseUrl}/api/employee/parking/exit/by-card/000000`, {
                method: "GET",
                headers: { Cookie: authCookie },
                timeout: 5000,
            });
            if (res.statusCode < 500) return Date.now() - start;
        } catch (_) {}
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`Recovery timeout: backend did not recover within ${timeoutMs}ms`);
}

async function run(ctx) {
    const start = Date.now();
    const assertions = [];

    try {
        // 1. Stop Postgres
        stopService("postgres");

        // 2. Assert error response within timeout
        const reqStart = Date.now();
        try {
            const res = await httpRequest(`${ctx.baseUrl}/api/employee/parking/entry`, {
                method: "POST",
                headers: { Cookie: ctx.authCookie, "Content-Type": "application/json" },
                body: JSON.stringify({ card_uid: "DISASTER_TEST", vehicle_type: "car", lot_id: ctx.seedData.lotId }),
                timeout: 5000,
            });
            const reqMs = Date.now() - reqStart;
            const passed = res.statusCode >= 500 && reqMs <= 5000;
            assertions.push({ description: "Returns error when DB is down", passed, actualMs: reqMs });
        } catch (err) {
            const reqMs = Date.now() - reqStart;
            // Timeout or connection error = also acceptable (server can't respond)
            assertions.push({ description: "Returns error when DB is down", passed: reqMs <= 5000, actualMs: reqMs });
        }

        // 3. Restart Postgres
        startService("postgres");

        // 4. Wait for recovery
        try {
            const recoveryMs = await waitForRecovery(ctx.baseUrl, ctx.authCookie, CONFIG.timeouts.recoveryTimeout);
            assertions.push({ description: "Recovers within 30s after restart", passed: true, actualMs: recoveryMs });
        } catch (err) {
            assertions.push({ description: "Recovers within 30s after restart", passed: false, actualMs: CONFIG.timeouts.recoveryTimeout });
        }
    } finally {
        // Always restore
        try { startService("postgres"); } catch (_) {}
    }

    const allPassed = assertions.every(a => a.passed);
    return {
        name: "disaster-db",
        status: allPassed ? "PASS" : "FAIL",
        metrics: null,
        error: allPassed ? null : assertions.find(a => !a.passed)?.description,
        durationMs: Date.now() - start,
        assertions,
    };
}

module.exports = { run };
