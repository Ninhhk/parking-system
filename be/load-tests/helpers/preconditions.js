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
 * Verify that the backend is reachable on the hot-path endpoints.
 * Aborts on first unreachable endpoint with descriptive error.
 * (Seed data is created by seed() immediately after, so it is not verified here.)
 *
 * @param {string} baseUrl - e.g. "http://localhost:5000"
 * @param {string} authCookie - e.g. "connect.sid=s%3A..."
 */
async function checkPreconditions(baseUrl, authCookie) {
    const headers = { Cookie: authCookie };

    // Probe hot-path endpoints — any HTTP response (even 404/405) means server is up.
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
}

module.exports = { checkPreconditions, request };
