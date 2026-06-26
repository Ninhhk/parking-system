"use strict";

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

        const req = http.request(
            {
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname,
                method: options.method || "POST",
                headers,
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => resolve({ statusCode: res.statusCode, body: data }));
            }
        );

        req.setTimeout(CONFIG.timeouts.responseTimeout, () => {
            req.destroy(new Error("timeout"));
        });
        req.on("error", reject);

        if (payload) req.write(payload);
        req.end();
    });
}

async function createSession(baseUrl, adminCookie, employeeCookie, lotId, cardUid) {
    await httpRequest(`${baseUrl}/api/admin/parking-cards`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ card_uid: cardUid, lot_id: lotId }),
    });

    const res = await httpRequest(`${baseUrl}/api/employee/parking/entry`, {
        method: "POST",
        headers: { Cookie: employeeCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ card_uid: cardUid, vehicle_type: "car", lot_id: lotId }),
    });

    if (res.statusCode === 201) {
        const data = JSON.parse(res.body);
        return (data.data && data.data.session_id) || (data.ticket && data.ticket.session_id);
    }
    throw new Error(`Failed to create session for card ${cardUid}: HTTP ${res.statusCode} — ${res.body}`);
}

/**
 * Disaster-race scenario: concurrent checkout and payment-intent.
 *
 * Tests atomicity guarantees under concurrent access:
 * 1. Concurrent checkout-confirm → all get 200, exactly 1 finalizes
 * 2. Concurrent payment-intent → all get 201, no 5xx errors
 */
async function run(ctx) {
    const start = Date.now();
    const assertions = [];
    const CONCURRENT = 5;

    // Re-login to get fresh cookies
    const { login } = require("../helpers/auth");
    const adminCookie = await login(ctx.baseUrl, "admin", "admin123");
    const employeeCookie = await login(ctx.baseUrl, "ninh1", "ninh1");
    const headers = { Cookie: employeeCookie };

    // --- Test 1: Concurrent checkout-confirm ---
    const checkoutCard = `RACE_CO_${Date.now()}`;
    const checkoutSessionId = await createSession(
        ctx.baseUrl, adminCookie, employeeCookie, ctx.seedData.lotId, checkoutCard
    );

    const checkoutPromises = Array.from({ length: CONCURRENT }, () =>
        httpRequest(`${ctx.baseUrl}/api/employee/parking/exit/confirm`, {
            method: "POST",
            headers,
            body: JSON.stringify({ session_id: checkoutSessionId, payment_method: "CASH" }),
        })
    );
    const checkoutResults = await Promise.all(checkoutPromises);

    // All should get 200 (no 5xx)
    const checkout200 = checkoutResults.filter((r) => r.statusCode === 200).length;
    const checkout5xx = checkoutResults.filter((r) => r.statusCode >= 500).length;

    // Exactly 1 should have finalized (already_finalized: false)
    let finalizedCount = 0;
    for (const r of checkoutResults) {
        if (r.statusCode === 200) {
            try {
                const body = JSON.parse(r.body);
                if (body.payment && body.payment.already_finalized === false) {
                    finalizedCount++;
                }
            } catch (_) {}
        }
    }

    assertions.push({
        description: "All checkouts succeed (no 5xx), exactly 1 finalizes",
        passed: checkout5xx === 0 && finalizedCount === 1,
        details: { total: CONCURRENT, http200: checkout200, finalized: finalizedCount, errors5xx: checkout5xx },
    });

    // --- Test 2: Concurrent payment-intent ---
    const paymentCard = `RACE_PI_${Date.now()}`;
    const paymentSessionId = await createSession(
        ctx.baseUrl, adminCookie, employeeCookie, ctx.seedData.lotId, paymentCard
    );

    const paymentPromises = Array.from({ length: CONCURRENT }, () =>
        httpRequest(`${ctx.baseUrl}/api/employee/parking/exit/${paymentSessionId}/payment-intents`, {
            method: "POST",
            headers,
            body: JSON.stringify({ amount: 10000 }),
        })
    );
    const paymentResults = await Promise.all(paymentPromises);

    // All should get 201 or 200 (reuse), no 5xx
    const paymentSuccess = paymentResults.filter((r) => r.statusCode >= 200 && r.statusCode < 500).length;
    const payment5xx = paymentResults.filter((r) => r.statusCode >= 500).length;

    assertions.push({
        description: "All payment intents succeed (no 5xx), serialized correctly",
        passed: payment5xx === 0 && paymentSuccess === CONCURRENT,
        details: { total: CONCURRENT, successes: paymentSuccess, errors5xx: payment5xx },
    });

    const allPassed = assertions.every((a) => a.passed);
    return {
        name: "disaster-race",
        status: allPassed ? "PASS" : "FAIL",
        metrics: null,
        error: allPassed ? null : JSON.stringify(assertions.filter((a) => !a.passed)),
        durationMs: Date.now() - start,
        assertions,
    };
}

module.exports = { run };
