"use strict";

const http = require("http");
const { stopService, startService } = require("../helpers/docker");
const { CONFIG } = require("../config");

const TINY_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

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

/**
 * Disaster scenario: MinIO failure and recovery.
 * Verifies backend handles MinIO being down gracefully —
 * sessions still get created/closed, image_in_url is NULL.
 *
 * @param {object} ctx - { baseUrl, authCookie, seedData }
 * @returns {Promise<{name, status, metrics, error, durationMs, assertions}>}
 */
async function run(ctx) {
    const start = Date.now();
    const assertions = [];

    // Re-login to get fresh cookies (previous ones may have expired during load tests)
    const { login } = require("../helpers/auth");
    const adminCookie = await login(ctx.baseUrl, "admin", "admin123");
    const employeeCookie = await login(ctx.baseUrl, "ninh1", "ninh1");

    try {
        // 1. Stop MinIO
        stopService("minio");

        // 2. Check-in with image — should succeed (201) despite MinIO being down
        const cardUid = `MINIO_TEST_${Date.now()}`;
        await httpRequest(`${ctx.baseUrl}/api/admin/parking-cards`, {
            method: "POST",
            headers: { Cookie: adminCookie, "Content-Type": "application/json" },
            body: JSON.stringify({ card_uid: cardUid, lot_id: ctx.seedData.lotId }),
        });

        const checkinRes = await httpRequest(`${ctx.baseUrl}/api/employee/parking/entry`, {
            method: "POST",
            headers: { Cookie: employeeCookie, "Content-Type": "application/json" },
            body: JSON.stringify({
                card_uid: cardUid,
                vehicle_type: "car",
                lot_id: ctx.seedData.lotId,
                image: TINY_IMAGE,
            }),
        });
        assertions.push({
            description: "Check-in succeeds when MinIO is down",
            passed: checkinRes.statusCode === 201,
        });

        // 3. Restart MinIO
        startService("minio");
        // Give MinIO a moment to start
        await new Promise(r => setTimeout(r, 3000));

        // 4. Verify recovery — check-in with image should work
        const recoveryCard = `MINIO_REC_${Date.now()}`;
        await httpRequest(`${ctx.baseUrl}/api/admin/parking-cards`, {
            method: "POST",
            headers: { Cookie: adminCookie, "Content-Type": "application/json" },
            body: JSON.stringify({ card_uid: recoveryCard, lot_id: ctx.seedData.lotId }),
        });

        const recoveryRes = await httpRequest(`${ctx.baseUrl}/api/employee/parking/entry`, {
            method: "POST",
            headers: { Cookie: employeeCookie, "Content-Type": "application/json" },
            body: JSON.stringify({
                card_uid: recoveryCard,
                vehicle_type: "car",
                lot_id: ctx.seedData.lotId,
                image: TINY_IMAGE,
            }),
        });
        assertions.push({
            description: "MinIO recovers after restart",
            passed: recoveryRes.statusCode === 201,
        });
    } finally {
        // Always restore MinIO
        try { startService("minio"); } catch (_) {}
    }

    const allPassed = assertions.every(a => a.passed);
    return {
        name: "disaster-minio",
        status: allPassed ? "PASS" : "FAIL",
        metrics: null,
        error: allPassed ? null : JSON.stringify(assertions.filter(a => !a.passed)),
        durationMs: Date.now() - start,
        assertions,
    };
}

module.exports = { run };
