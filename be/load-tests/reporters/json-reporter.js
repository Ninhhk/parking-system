"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Write load test results as pretty-printed JSON.
 * @param {Array} results - Array of ScenarioResult objects
 * @param {object} metadata - ReportMetadata object
 * @param {string} outputDir - Directory to write results to
 */
function writeJsonReport(results, metadata, outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });

    const report = { metadata, results };
    const filePath = path.join(outputDir, "load-test-results.json");

    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), "utf8");
}

module.exports = { writeJsonReport };
