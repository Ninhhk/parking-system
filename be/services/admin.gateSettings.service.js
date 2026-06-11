const gateSettingsRepo = require("../repositories/gateSettings.repo");

const MIN_DURATION = 2;
const MAX_DURATION = 30;
const DEFAULT_DURATION = 4;

function validate(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        return { field: "auto_close_duration_seconds", message: "Must be an integer" };
    }
    if (value < MIN_DURATION || value > MAX_DURATION) {
        return { field: "auto_close_duration_seconds", message: `Must be between ${MIN_DURATION} and ${MAX_DURATION} seconds` };
    }
    return null;
}

async function getGateSettings() {
    const row = await gateSettingsRepo.getSettings();
    if (!row) {
        return { auto_close_duration_seconds: DEFAULT_DURATION };
    }
    return row;
}

async function updateGateSettings(value) {
    const error = validate(value);
    if (error) {
        return { success: false, status: 422, error };
    }
    const updated = await gateSettingsRepo.upsertSettings(value);
    return { success: true, data: updated };
}

module.exports = {
    MIN_DURATION,
    MAX_DURATION,
    DEFAULT_DURATION,
    validate,
    getGateSettings,
    updateGateSettings,
};
