const feeConfigRepo = require("../repositories/feeConfig.repo");

function validateFeeConfig(data) {
    const errors = [];

    if (!Number.isInteger(data.hourly_rate) || data.hourly_rate < 2000)
        errors.push({ field: "hourly_rate", message: "Must be a whole number >= 2000" });

    if (!Number.isInteger(data.daily_cap_amount) || data.daily_cap_amount < 2000)
        errors.push({ field: "daily_cap_amount", message: "Must be a whole number >= 2000" });

    if (!Number.isInteger(data.penalty_fee) || data.penalty_fee < 2000)
        errors.push({ field: "penalty_fee", message: "Must be a whole number >= 2000" });

    if (data.grace_period_minutes < 0 || data.grace_period_minutes > 60)
        errors.push({ field: "grace_period_minutes", message: "Must be between 0 and 60" });

    if (data.tiered_rate_enabled) {
        (data.tiers || []).forEach((tier, i) => {
            const prev = (data.tiers || [])[i - 1];
            if (prev && tier.up_to_hours !== null && tier.up_to_hours <= prev.up_to_hours)
                errors.push({ field: `tiers[${i}].up_to_hours`, message: "Must be strictly greater than previous bracket" });
        });
    }

    if (data.time_of_day_enabled) {
        (data.time_windows || []).forEach((w, i) => {
            if (w.rate_multiplier <= 0)
                errors.push({ field: `time_windows[${i}].rate_multiplier`, message: "Must be > 0" });
        });
    }

    return errors;
}

async function createFeeConfigVersion(configData, createdByUserId) {
    const errors = validateFeeConfig(configData);
    if (errors.length > 0) {
        const err = new Error("Validation failed");
        err.status = 422;
        err.fields = errors;
        throw err;
    }
    return feeConfigRepo.createVersion({ ...configData, created_by: createdByUserId });
}

async function getActiveFeeConfigs() {
    const now = new Date();
    const [car, bike] = await Promise.all([
        feeConfigRepo.getActiveConfig("car", now),
        feeConfigRepo.getActiveConfig("bike", now),
    ]);
    return { car, bike };
}

async function getFeeConfigVersions(vehicleType) {
    return feeConfigRepo.getAllVersions(vehicleType);
}

module.exports = { validateFeeConfig, createFeeConfigVersion, getActiveFeeConfigs, getFeeConfigVersions };
