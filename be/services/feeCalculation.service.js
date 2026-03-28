/**
 * Fee Calculation Service
 * 
 * Single source of truth for parking fee calculations.
 * Eliminates duplicated logic between initiateCheckout and confirmCheckout.
 */

const { MAX_PARKING_HOURS, MAX_PAYMENT_AMOUNT } = require('../config/constants');
const { calculateHoursDifference } = require('../utils/date');

/**
 * Calculates parking hours from check-in time to current time
 * @param {Date|string} timeIn - Check-in timestamp
 * @param {Date} [currentTime] - Current time (defaults to now)
 * @returns {number} Hours parked (rounded up)
 */
function calculateParkingHours(timeIn, currentTime = new Date()) {
    const checkInTime = new Date(timeIn);
    return Math.ceil(calculateHoursDifference(checkInTime, currentTime));
}

/**
 * Validates parking duration against maximum allowed
 * @param {number} hours - Parking hours
 * @returns {{valid: boolean, error?: string}}
 */
function validateParkingDuration(hours) {
    if (hours > MAX_PARKING_HOURS) {
        return {
            valid: false,
            error: `Parking duration exceeds maximum allowed (${MAX_PARKING_HOURS} hours / 30 days). Please contact administrator.`,
            hours
        };
    }
    return { valid: true };
}

/**
 * Validates total amount against database limits
 * @param {number} amount - Total amount
 * @returns {{valid: boolean, error?: string}}
 */
function validatePaymentAmount(amount) {
    if (amount > MAX_PAYMENT_AMOUNT) {
        return {
            valid: false,
            error: `Calculated amount (${amount.toFixed(2)}) exceeds maximum allowed (${MAX_PAYMENT_AMOUNT}). Please contact administrator.`,
            amount
        };
    }
    return { valid: true };
}

/**
 * Calculates parking fee based on session details
 * 
 * @param {Object} session - Parking session with fee config
 * @param {boolean} session.is_monthly - Whether vehicle has monthly subscription
 * @param {boolean} session.is_lost - Whether ticket is lost
 * @param {number|string} session.service_fee - Hourly service fee
 * @param {number|string} session.penalty_fee - Lost ticket penalty fee
 * @param {number} hours - Number of hours parked
 * @returns {Object} Fee breakdown
 */
function calculateParkingFee(session, hours) {
    const serviceFeePerHour = parseFloat(session.service_fee) || 0;
    const penaltyFee = parseFloat(session.penalty_fee) || 0;

    let calculatedServiceFee = 0;
    let calculatedPenaltyFee = 0;

    // Monthly subscribers don't pay service fee
    if (!session.is_monthly) {
        // Charge for at least 1 hour, then multiply by hours
        calculatedServiceFee = hours <= 1 ? serviceFeePerHour : serviceFeePerHour * hours;
    }

    // Lost ticket penalty applies regardless of subscription type
    if (session.is_lost) {
        calculatedPenaltyFee = penaltyFee;
    }

    const totalAmount = calculatedServiceFee + calculatedPenaltyFee;

    return {
        serviceFee: calculatedServiceFee,
        penaltyFee: calculatedPenaltyFee,
        totalAmount,
        hours,
        isMonthly: session.is_monthly,
        isLost: session.is_lost
    };
}

/**
 * Full fee calculation with validation
 * 
 * @param {Object} session - Parking session
 * @param {Date} [currentTime] - Current time (defaults to now)
 * @returns {Object} Fee calculation result with validation
 */
function calculateAndValidateFee(session, currentTime = new Date()) {
    const hours = calculateParkingHours(session.time_in, currentTime);

    // Validate duration
    const durationValidation = validateParkingDuration(hours);
    if (!durationValidation.valid) {
        return {
            success: false,
            error: durationValidation.error,
            hours
        };
    }

    // Calculate fee
    const feeResult = calculateParkingFee(session, hours);

    // Validate amount
    const amountValidation = validatePaymentAmount(feeResult.totalAmount);
    if (!amountValidation.valid) {
        return {
            success: false,
            error: amountValidation.error,
            hours,
            totalAmount: feeResult.totalAmount
        };
    }

    return {
        success: true,
        ...feeResult
    };
}

module.exports = {
    calculateParkingHours,
    validateParkingDuration,
    validatePaymentAmount,
    calculateParkingFee,
    calculateAndValidateFee
};
