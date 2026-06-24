"use strict";

const { execSync } = require("child_process");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../../../");

/**
 * Stop a Docker Compose service.
 * @param {string} serviceName - e.g. "postgres", "minio"
 */
function stopService(serviceName) {
    try {
        execSync(`docker compose stop ${serviceName}`, {
            cwd: REPO_ROOT,
            stdio: "pipe",
        });
    } catch (err) {
        throw new Error(
            `Failed to stop service: ${serviceName} — ${err.message}`
        );
    }
}

/**
 * Start a Docker Compose service.
 * @param {string} serviceName - e.g. "postgres", "minio"
 */
function startService(serviceName) {
    try {
        execSync(`docker compose start ${serviceName}`, {
            cwd: REPO_ROOT,
            stdio: "pipe",
        });
    } catch (err) {
        throw new Error(
            `Failed to start service: ${serviceName} — ${err.message}`
        );
    }
}

module.exports = { stopService, startService };
