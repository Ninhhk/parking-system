"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

/**
 * Send an event payload to the ingest endpoint via HTTP POST.
 * @param {string} url - Full URL of the ingest endpoint
 * @param {string} apiKey - Value for x-edge-api-key header
 * @param {object} payload - JSON-serializable event payload
 * @returns {Promise<{status: number, body: object|string}>}
 */
const sendEvent = (url, apiKey, payload) => {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const transport = parsed.protocol === "https:" ? https : http;
        const data = JSON.stringify(payload);

        const options = {
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-edge-api-key": apiKey,
                "Content-Length": Buffer.byteLength(data),
            },
        };

        const req = transport.request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => {
                body += chunk;
            });
            res.on("end", () => {
                let parsed;
                try {
                    parsed = JSON.parse(body);
                } catch {
                    parsed = body;
                }
                resolve({ status: res.statusCode, body: parsed });
            });
        });

        req.on("error", (err) => {
            reject(new Error(`Request failed: ${err.message}`));
        });

        req.write(data);
        req.end();
    });
};

module.exports = { sendEvent };
