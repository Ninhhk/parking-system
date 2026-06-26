const gateSettingsRepo = require("../repositories/gateSettings.repo");

const MIN_DURATION = 2;
const MAX_DURATION = 30;
const DEFAULT_DURATION = 4;

const MIN_INPUT_RESET = 0;
const MAX_INPUT_RESET = 10;
const DEFAULT_INPUT_RESET = 2;

function validateDuration(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        return { field: "auto_close_duration_seconds", message: "Must be an integer" };
    }
    if (value < MIN_DURATION || value > MAX_DURATION) {
        return { field: "auto_close_duration_seconds", message: `Must be between ${MIN_DURATION} and ${MAX_DURATION} seconds` };
    }
    return null;
}

function validateInputReset(value) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
        return { field: "kiosk_input_reset_seconds", message: "Must be an integer" };
    }
    if (value < MIN_INPUT_RESET || value > MAX_INPUT_RESET) {
        return { field: "kiosk_input_reset_seconds", message: `Must be between ${MIN_INPUT_RESET} and ${MAX_INPUT_RESET} seconds` };
    }
    return null;
}

async function getGateSettings() {
    const row = await gateSettingsRepo.getSettings();
    if (!row) {
        return {
            auto_close_duration_seconds: DEFAULT_DURATION,
            kiosk_input_reset_seconds: DEFAULT_INPUT_RESET,
        };
    }
    return row;
}

async function updateGateSettings({ auto_close_duration_seconds, kiosk_input_reset_seconds }) {
    // Merge with current values so a partial update never nulls a column.
    const current = await getGateSettings();
    const duration =
        auto_close_duration_seconds === undefined
            ? current.auto_close_duration_seconds
            : auto_close_duration_seconds;
    const inputReset =
        kiosk_input_reset_seconds === undefined
            ? current.kiosk_input_reset_seconds
            : kiosk_input_reset_seconds;

    const error = validateDuration(duration) || validateInputReset(inputReset);
    if (error) {
        return { success: false, status: 422, error };
    }

    const updated = await gateSettingsRepo.upsertSettings(duration, inputReset);
    return { success: true, data: updated };
}

module.exports = {
    MIN_DURATION,
    MAX_DURATION,
    DEFAULT_DURATION,
    MIN_INPUT_RESET,
    MAX_INPUT_RESET,
    DEFAULT_INPUT_RESET,
    validateDuration,
    validateInputReset,
    getGateSettings,
    updateGateSettings,
};
