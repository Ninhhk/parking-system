/**
 * Scenario validation — pure functions.
 * Validates scenario objects against required fields and conditional rules.
 */

const REQUIRED_FIELDS = ["name", "gateway_id", "lane_id", "trigger_type", "vehicle_type", "lot_id"];
const TRIGGER_TYPES_REQUIRING_VALUE = ["IC_CARD", "UHF_TAG"];

/**
 * Validate a single scenario object.
 * @param {object} scenario
 * @returns {{ valid: boolean, errors: string[] }}
 */
const validateScenario = (scenario) => {
    const errors = [];

    // Check required fields exist and are non-empty strings
    for (const field of REQUIRED_FIELDS) {
        if (typeof scenario[field] !== "string" || scenario[field].trim() === "") {
            errors.push(`Missing or empty required field: ${field}`);
        }
    }

    // Conditional: IC_CARD / UHF_TAG require trigger_value
    if (TRIGGER_TYPES_REQUIRING_VALUE.includes(scenario.trigger_type)) {
        if (typeof scenario.trigger_value !== "string" || scenario.trigger_value.trim() === "") {
            errors.push(`trigger_type "${scenario.trigger_type}" requires a non-empty trigger_value`);
        }
    }

    // Conditional: LPD requires plate or image_path
    if (scenario.trigger_type === "LPD") {
        const hasPlate = typeof scenario.plate === "string" && scenario.plate.trim() !== "";
        const hasImage = typeof scenario.image_path === "string" && scenario.image_path.trim() !== "";
        if (!hasPlate && !hasImage) {
            errors.push("trigger_type \"LPD\" requires either plate or image_path");
        }
    }

    return { valid: errors.length === 0, errors };
};

/**
 * Validate an array of scenarios.
 * @param {object[]} scenarios
 * @returns {{ valid: boolean, results: Object.<string, string[]> }}
 */
const validateAll = (scenarios) => {
    const results = {};
    let allValid = true;

    for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        const { valid, errors } = validateScenario(scenario);
        const key = scenario.name || `scenario[${i}]`;
        if (!valid) {
            allValid = false;
            results[key] = errors;
        }
    }

    return { valid: allValid, results };
};

module.exports = { validateScenario, validateAll };
