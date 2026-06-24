"use strict";

const http = require("http");
const { CONFIG } = require("../config");

/**
 * Make an HTTP request. Resolves with { statusCode, body }.
 */
function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const payload = options.body ? JSON.stringify(options.body) : null;
        const headers = { ...options.headers };

        if (payload) {
            headers["Content-Type"] = "application/json";
            headers["Content-Length"] = Buffer.byteLength(payload);
        }

        const req = http.request(
            {
                hostname: parsed.hostname,
                port: parsed.port,
                path: parsed.pathname + parsed.search,
                method: options.method || "GET",
                headers,
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => resolve({ statusCode: res.statusCode, body: data }));
            }
        );

        req.setTimeout(CONFIG.timeouts.responseTimeout, () => {
            req.destroy(new Error(`Cleanup request to ${url} timed out`));
        });
        req.on("error", (err) => reject(err));

        if (payload) req.write(payload);
        req.end();
    });
}

/**
 * Clean up test data created by seed. Idempotent — safe to call even if data
 * doesn't exist. Minimal since Docker reset cleans everything.
 *
 * @param {string} baseUrl - e.g. "http://localhost:5000"
 * @param {string} authCookie - e.g. "connect.sid=s%3A..."
 * @param {{lotId: number, sessionId: number, cardUid: string}} seedData
 */
async function cleanup(baseUrl, authCookie, seedData) {
    if (!seedData) return;

    const headers = { Cookie: authCookie };

    // Try to delete the test card (returns 404 if already gone — that's fine)
    if (seedData.cardUid) {
        try {
            await request(`${baseUrl}/api/admin/parking-cards/${seedData.cardUid}`, {
                method: "DELETE",
                headers,
            });
        } catch (_) {
            // Ignore — cleanup is best-effort
        }
    }
}

module.exports = { cleanup };
