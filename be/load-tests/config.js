"use strict";

const CONFIG = {
    baseUrl: "http://localhost:5000",
    outputDir: "./load-test-results",
    load: {
        duration: 15,        // seconds
        connections: 30,     // concurrent
    },
    perf: {
        levels: [10, 25, 50, 100],
        durationPerLevel: 10, // seconds
    },
    timeouts: {
        responseTimeout: 10000, // ms — 2x connectionTimeoutMillis
        recoveryTimeout: 30000, // ms — max wait for DB recovery
    },
};

module.exports = { CONFIG };
