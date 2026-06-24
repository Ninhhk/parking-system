"use strict";

const http = require("http");

/**
 * Login to the backend and return the session cookie header value.
 *
 * @param {string} baseUrl - e.g. "http://localhost:5000"
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>} Full cookie header value (e.g. "connect.sid=s%3A...")
 */
async function login(baseUrl, username, password) {
    const url = new URL("/api/auth/login", baseUrl);
    const body = JSON.stringify({ username, password });

    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                },
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(
                            `Login failed for ${username}: HTTP ${res.statusCode} — ${data}`
                        ));
                        return;
                    }

                    const setCookie = res.headers["set-cookie"];
                    if (!setCookie || setCookie.length === 0) {
                        reject(new Error(
                            "Login failed: no set-cookie header in response"
                        ));
                        return;
                    }

                    const sidCookie = setCookie.find(
                        (c) => c.startsWith("connect.sid=")
                    );
                    if (!sidCookie) {
                        reject(new Error(
                            "Login failed: connect.sid cookie not found"
                        ));
                        return;
                    }

                    const cookieValue = sidCookie.split(";")[0];
                    resolve(cookieValue);
                });
            }
        );

        req.on("error", (err) => {
            reject(new Error(`Login failed: cannot reach ${url.href} — ${err.message}`));
        });

        req.write(body);
        req.end();
    });
}

module.exports = { login };
