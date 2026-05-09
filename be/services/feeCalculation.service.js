// Feature: fee-calculation-engine
// Requirements: 1.1, 1.5, 9.2, 13.1

const { MAX_PARKING_HOURS, MAX_PAYMENT_AMOUNT } = require("../config/constants");
const { calculateHoursDifference } = require("../utils/date");
const feeConfigRepo = require("../repositories/feeConfig.repo");
const feeEngine = require("./feeEngine.service");

/**
 * Calculates and validates the parking fee for a session.
 *
 * @param {Object} session - Parking session row
 * @param {Date} [currentTime] - Wall-clock time used as time_out for in-progress sessions
 * @returns {Promise<Object>} { success: true, ...breakdown } or { success: false, error }
 */
async function calculateAndValidateFee(session, currentTime = new Date()) {
    const rawHours = calculateHoursDifference(new Date(session.time_in), currentTime);

    if (rawHours > MAX_PARKING_HOURS) {
        return {
            success: false,
            error: `Parking duration exceeds maximum allowed (${MAX_PARKING_HOURS} hours).`,
            hours: rawHours,
        };
    }

    const config = await feeConfigRepo.getActiveConfig(session.vehicle_type, session.time_in);
    if (!config) {
        return { success: false, error: "No active fee configuration found" };
    }

    const ctx = feeEngine.buildContext(session, config, currentTime);
    const breakdown = feeEngine.runPipeline(ctx, !!session.is_monthly);

    if (breakdown.totalAmount > MAX_PAYMENT_AMOUNT) {
        return {
            success: false,
            error: `Calculated amount exceeds maximum allowed (${MAX_PAYMENT_AMOUNT}).`,
            totalAmount: breakdown.totalAmount,
        };
    }

    return { success: true, ...breakdown };
}

module.exports = { calculateAndValidateFee };
