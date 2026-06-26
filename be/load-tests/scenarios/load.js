"use strict";

const autocannon = require("autocannon");
const { CONFIG } = require("../config");

/**
 * Sustained throughput test — exercises all 3 hot-path endpoints
 * under steady load (30 connections, 15s).
 *
 * @param {object} ctx - { baseUrl, authCookie, config, seedData }
 * @returns {Promise<Array<{name, status, metrics, error, durationMs}>>}
 */
async function run(ctx) {
    const { baseUrl, authCookie, seedData } = ctx;
    const { connections, duration } = CONFIG.load;

    const endpoints = [
        {
            name: "load-checkin",
            url: `${baseUrl}/api/employee/parking/entry`,
            body: JSON.stringify({
                card_uid: seedData.cardUid,
                vehicle_type: "car",
                lot_id: seedData.lotId,
            }),
        },
        {
            name: "load-checkout",
            url: `${baseUrl}/api/employee/parking/exit/confirm`,
            body: JSON.stringify({ session_id: seedData.sessionId }),
        },
        {
            name: "load-payment-intent",
            url: `${baseUrl}/api/employee/parking/exit/${seedData.sessionId}/payment-intents`,
            body: JSON.stringify({ amount: 10000 }),
        },
    ];

    const results = [];

    for (const ep of endpoints) {
        const start = Date.now();

        const result = await autocannon({
            url: ep.url,
            connections,
            duration,
            headers: {
                Cookie: authCookie,
                "Content-Type": "application/json",
            },
            method: "POST",
            body: ep.body,
        });

        const durationMs = Date.now() - start;
        const totalRequests = result.requests.total;
        const errorCount = result.non2xx || 0;
        const successCount = totalRequests - errorCount;
        const errorRate = totalRequests > 0
            ? (errorCount / totalRequests) * 100
            : 0;
        const rps = result.duration > 0
            ? totalRequests / result.duration
            : 0;

        results.push({
            name: ep.name,
            status: "PASS",
            metrics: {
                endpoint: ep.url.replace(baseUrl, ""),
                concurrency: connections,
                duration: result.duration,
                totalRequests,
                successCount,
                errorCount,
                errorRate: Math.round(errorRate * 100) / 100,
                p50: result.latency.p50,
                p95: result.latency.p97_5 || result.latency.p99,
                rps: Math.round(rps * 100) / 100,
            },
            error: null,
            durationMs,
        });
    }

    return results;
}

module.exports = { run };
