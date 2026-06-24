const { pool } = require("../config/db");

exports.getActiveConfig = async (vehicleType, referenceTime) => {
    const result = await pool.query(
        `SELECT *
         FROM fee_config_versions
         WHERE vehicle_type = $1
           AND effective_from <= $2
         ORDER BY effective_from DESC
         LIMIT 1`,
        [vehicleType, referenceTime]
    );

    if (!result.rows[0]) return null;

    const row = result.rows[0];
    return {
        ...row,
        // node-postgres returns NUMERIC/DECIMAL columns as strings. Coerce the
        // numeric fee fields to numbers so rules that use "+" (penalty, daily cap)
        // perform arithmetic instead of string concatenation.
        hourly_rate:      Number(row.hourly_rate),
        daily_cap_amount: Number(row.daily_cap_amount),
        penalty_fee:      Number(row.penalty_fee),
        tiers:        row.tiers        || [],
        time_windows: row.time_windows || [],
    };
};

exports.getAllVersions = async (vehicleType) => {
    const result = await pool.query(
        `SELECT *
         FROM fee_config_versions
         WHERE vehicle_type = $1
         ORDER BY effective_from DESC`,
        [vehicleType]
    );
    return result.rows;
};

exports.createVersion = async (configData) => {
    const {
        vehicle_type,
        effective_from,
        rounding_strategy,
        grace_period_minutes,
        hourly_rate,
        daily_cap_enabled,
        daily_cap_amount,
        tiered_rate_enabled,
        tiers,
        time_of_day_enabled,
        time_windows,
        penalty_fee,
        created_by,
    } = configData;

    const result = await pool.query(
        `INSERT INTO fee_config_versions
            (vehicle_type, effective_from, rounding_strategy, grace_period_minutes,
             hourly_rate, daily_cap_enabled, daily_cap_amount,
             tiered_rate_enabled, tiers,
             time_of_day_enabled, time_windows,
             penalty_fee, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12, $13)
         RETURNING *`,
        [
            vehicle_type,
            effective_from,
            rounding_strategy,
            grace_period_minutes,
            hourly_rate,
            daily_cap_enabled,
            daily_cap_amount,
            tiered_rate_enabled,
            JSON.stringify(tiers || []),
            time_of_day_enabled,
            JSON.stringify(time_windows || []),
            penalty_fee,
            created_by,
        ]
    );

    return result.rows[0];
};
