"use strict";

const os = require("os");

/**
 * Collect system metadata for load-test reports.
 * @returns {ReportMetadata}
 */
function getMetadata() {
    return {
        timestamp: new Date().toISOString(),
        cpu: os.cpus()[0].model,
        ramGB: Math.round(os.totalmem() / 1e9),
        os: `${os.type()} ${os.release()}`,
        nodeVersion: process.version,
        dbPoolMax: 20,
    };
}

module.exports = { getMetadata };
