"use strict";

/**
 * Classify HTTP status code as success or failure.
 * 200–499 → "success" (valid responses including client errors)
 * 500–599 → "failure" (server errors)
 * Anything else (including undefined/null for timeouts) → "failure"
 */
function classify(statusCode) {
    if (statusCode >= 200 && statusCode <= 499) {
        return "success";
    }
    return "failure";
}

/**
 * Compute error count and error rate from an array of classification results.
 * @param {Array<"success"|"failure">} results
 * @returns {{ errorCount: number, errorRate: number }}
 */
function computeErrorRate(results) {
    if (!results || results.length === 0) {
        return { errorCount: 0, errorRate: 0 };
    }
    const errorCount = results.filter(r => r === "failure").length;
    const errorRate = (errorCount / results.length) * 100;
    return { errorCount, errorRate };
}

module.exports = { classify, computeErrorRate };
