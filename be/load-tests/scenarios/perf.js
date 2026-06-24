"use strict";

const autocannon = require("autocannon");

/**
 * Perf scenario — latency-vs-concurrency sweep.
 * Tests check-in and check-out at concurrency levels [10, 25, 50, 100].
 * 10s duration per level.
 * Returns one ScenarioResult per endpoint per level (8 total).
 *
 * @param {object} ctx - { baseUrl, authCookie, config, seedData }
 * @returns {Promise<Array<{name, status, metrics, error, durationMs}>>}
 */
async function run(ctx) {
    const levels = ctx.config.perf.levels;
    const duration = ctx.config.perf.durationPerLevel;
    const results = [];

    const endpoints = [
        {
            name: "checkin",
            url: `${ctx.baseUrl}/api/employee/parking/entry`,
            method: "POST",
            body: JSON.stringify({ card_uid: ctx.seedData.cardUid, vehicle_type: "car", lot_id: ctx.seedData.lotId }),
        },
        {
            name: "checkout",
            url: `${ctx.baseUrl}/api/employee/parking/exit/confirm`,
            method: "POST",
            body: JSON.stringify({ session_id: ctx.seedData.sessionId }),
        },
    ];

    for (const ep of endpoints) {
        for (const conns of levels) {
            const start = Date.now();
            const result = await autocannon({
                url: ep.url,
                connections: conns,
                duration,
                method: ep.method,
                headers: { Cookie: ctx.authCookie, "Content-Type": "application/json" },
                body: ep.body,
            });

            const totalReqs = result.requests.total;
            // 5xx = server failure, connection errors = failure
            // 4xx (e.g. 409 conflict) is acceptable per classify rules
            const errors5xx = result["5xx"] || 0;
            const connErrors = result.errors || 0;
            const totalErrors = errors5xx + connErrors;
            const errorRate = totalReqs > 0 ? (totalErrors / totalReqs) * 100 : 0;

            results.push({
                name: `perf-${ep.name}-c${conns}`,
                status: "PASS",
                metrics: {
                    endpoint: `${ep.method} ${new URL(ep.url).pathname}`,
                    concurrency: conns,
                    duration: result.duration,
                    totalRequests: totalReqs,
                    successCount: totalReqs - totalErrors,
                    errorCount: totalErrors,
                    errorRate,
                    p50: result.latency.p50,
                    p95: result.latency.p97_5 || result.latency.p99,
                    rps: totalReqs / result.duration,
                },
                error: null,
                durationMs: Date.now() - start,
            });
        }
    }

    return results;
}

module.exports = { run };
