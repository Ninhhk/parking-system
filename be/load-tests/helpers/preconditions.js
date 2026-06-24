"use strict";

const http = require("http");
const { CONFIG } = require("../config");

/**
 * Make a simple HTTP request. Resolves with { statusCode, body }.
 * Rejects on connection refused, timeout, or network error.
 */
function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || CONFIG.timeouts.responseTimeout;
        const req = http.request(url, { method: options.method || "GET", headers: options.headers || {} }, (res) => {
            let body = "";
            res.on("data", (chunk) => { body += chunk; });
            res.on("end", () => resolve({ statusCode: res.statusCode, body }));
        });
        req.setTimeout(timeout, () => {
            req.destroy(new Error(`Request to ${url} timed out after ${timeout}ms`));
        });
        req.on("error", (err) => reject(err));
        req.end();
    });
}

/**
 * Verify that the backend is running and seed data exists.
 * Aborts on first unreachable endpoint with descriptive error.
 *
 * @param {string} baseUrl - e.g. "http://localhost:5000"
 * @param {string} authCookie - e.g. "connect.sid=s%3A..."
 */
async function checkPreconditions(baseUrl, authCookie) {
    const headers = { Cookie: authCookie };

    // Endpoints to probe — any HTTP response (even 404/405) means server is up.
    // Connection refused or timeout means server is down.
    const probes = [
        { url: `${baseUrl}/api/employee/parking/exit/by-card/000000`, label: "checkout-by-card" },
        { url: `${baseUrl}/api/employee/parking/entry`, label: "check-in" },
    ];

    for (const probe of probes) {
        try {
            await request(probe.url, { method: "GET", headers });
        } catch (err) {
            throw new Error(
                `Precondition failed: endpoint "${probe.label}" (${probe.url}) is unreachable — ${err.message}`
            );
        }
    }

    // Verify seed data: at least 1 available card
    try {
        const cardsRes = await request(`${baseUrl}/api/admin/cards`, { method: "GET", headers });
        if (cardsRes.statusCode === 200) {
            const data = JSON.parse(cardsRes.body);
            const cards = data.cards || data.data || data;
            if (Array.isArray(cards) && cards.length === 0) {
                throw new Error("Precondition failed: no cards found in system — seed data required");
            }
        }
    } catch (err) {
        if (err.message.startsWith("Precondition failed")) throw err;
        throw new Error(`Precondition failed: could not verify seed data (cards) — ${err.message}`);
    }

    // Verify seed data: at least 1 active session
    try {
        const sessionsRes = await request(`${baseUrl}/api/employee/parking/sessions/active`, { method: "GET", headers });
        if (sessionsRes.statusCode === 200) {
            const data = JSON.parse(sessionsRes.body);
            const sessions = data.sessions || data.data || data;
            if (Array.isArray(sessions) && sessions.length === 0) {
                throw new Error("Precondition failed: no active parking sessions found — seed data required");
            }
        }
    } catch (err) {
        if (err.message.startsWith("Precondition failed")) throw err;
        throw new Error(`Precondition failed: could not verify seed data (active sessions) — ${err.message}`);
    }
}

module.exports = { checkPreconditions, request };
