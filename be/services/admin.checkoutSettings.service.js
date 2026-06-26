const checkoutSettingsRepo = require("../repositories/checkoutSettings.repo");

const ALLOWED_METHODS = ["CARD", "CASH"];
const DEFAULT_PAYMENT_METHOD = "CARD";

function validate(value) {
    if (!ALLOWED_METHODS.includes(value)) {
        return {
            field: "default_payment_method",
            message: `Must be one of: ${ALLOWED_METHODS.join(", ")}`,
        };
    }
    return null;
}

async function getCheckoutSettings() {
    const row = await checkoutSettingsRepo.getSettings();
    if (!row) {
        return { default_payment_method: DEFAULT_PAYMENT_METHOD };
    }
    return row;
}

async function updateCheckoutSettings(value) {
    const error = validate(value);
    if (error) {
        return { success: false, status: 422, error };
    }
    const updated = await checkoutSettingsRepo.upsertSettings(value);
    return { success: true, data: updated };
}

module.exports = {
    ALLOWED_METHODS,
    DEFAULT_PAYMENT_METHOD,
    validate,
    getCheckoutSettings,
    updateCheckoutSettings,
};
