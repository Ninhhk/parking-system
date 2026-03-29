/**
 * Application Constants Configuration
 * 
 * Centralized location for all configurable values that were previously
 * hardcoded throughout the codebase. Allows easy modification and testing.
 */

// Session Configuration
const SESSION_MAX_AGE_HOURS = parseInt(process.env.SESSION_MAX_AGE_HOURS || '8', 10);
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_HOURS * 60 * 60 * 1000;

// Parking Business Rules
const MAX_PARKING_HOURS = parseInt(process.env.MAX_PARKING_HOURS || '720', 10); // 30 days
const MAX_PAYMENT_AMOUNT = parseFloat(process.env.MAX_PAYMENT_AMOUNT || '99999999.99'); // NUMERIC(10,2) limit
const DEFAULT_PENALTY_FEE = parseFloat(process.env.DEFAULT_PENALTY_FEE || '50000');
const DEFAULT_PARKING_FEE = 0;

// Valid Values
const VALID_PAYMENT_METHODS = ['CASH', 'CARD'];
const VALID_VEHICLE_TYPES = ['car', 'bike'];

// License Plate Validation
const LICENSE_PLATE_REGEX = /^[A-Z0-9-]+$/i;

// LPD Service Configuration
const LPD_SERVICE_URL = process.env.LPD_API_URL || 'http://localhost:8000';
const LPD_DETECT_ENDPOINT = '/api/detect';
const LPD_TIMEOUT_MS = parseInt(process.env.LPD_TIMEOUT || '30000', 10);
const LPD_HEALTH_CHECK_TIMEOUT_MS = 5000;
const LPD_DEFAULT_CONFIDENCE = 0.9;

// Guest Defaults for Lost Ticket
const UNKNOWN_GUEST_IDENTIFIER = 'UNKNOWN';

// Payment Attempt
const PAYMENT_ATTEMPT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED'];
const PAYMENT_PROVIDERS = ['PAYOS', 'OFFLINE'];

// PayOS
const PAYOS_DEFAULT_RETURN_URL =
    process.env.PAYOS_RETURN_URL || 'http://localhost:3000/employee/checkout';
const PAYOS_DEFAULT_CANCEL_URL =
    process.env.PAYOS_CANCEL_URL || 'http://localhost:3000/employee/checkout';

// Feature Flags
const PAYMENT_INTENT_V2_ENABLED = String(process.env.PAYMENT_INTENT_V2_ENABLED || 'true') === 'true';

module.exports = {
    // Session
    SESSION_MAX_AGE_HOURS,
    SESSION_MAX_AGE_MS,

    // Parking Rules
    MAX_PARKING_HOURS,
    MAX_PAYMENT_AMOUNT,
    DEFAULT_PENALTY_FEE,
    DEFAULT_PARKING_FEE,

    // Valid Values
    VALID_PAYMENT_METHODS,
    VALID_VEHICLE_TYPES,

    // License Plate
    LICENSE_PLATE_REGEX,

    // LPD
    LPD_SERVICE_URL,
    LPD_DETECT_ENDPOINT,
    LPD_TIMEOUT_MS,
    LPD_HEALTH_CHECK_TIMEOUT_MS,
    LPD_DEFAULT_CONFIDENCE,

    // Guest Defaults
    UNKNOWN_GUEST_IDENTIFIER,

    // Payment Attempt
    PAYMENT_ATTEMPT_STATUSES,
    PAYMENT_PROVIDERS,

    // PayOS
    PAYOS_DEFAULT_RETURN_URL,
    PAYOS_DEFAULT_CANCEL_URL,

    // Feature Flags
    PAYMENT_INTENT_V2_ENABLED,
};
