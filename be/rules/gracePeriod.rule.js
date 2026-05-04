// Feature: fee-calculation-engine
// Rule: Grace Period
// Requirements: 2.1, 2.2, 2.4

/**
 * @param {RuleContext} ctx
 * @param {FeeAccumulator} acc
 * @returns {FeeAccumulator}
 */
function apply(ctx, acc) {
    const timeIn = new Date(ctx.session.time_in);
    const timeOut = new Date(ctx.session.time_out);
    const durationMinutes = (timeOut - timeIn) / (1000 * 60);
    const gracePeriodMinutes = ctx.config.grace_period_minutes;

    if (durationMinutes <= gracePeriodMinutes) {
        return {
            ...acc,
            serviceFee: 0,
            billableMinutes: 0,
            gracePeriodMinutes,
        };
    }

    return {
        ...acc,
        billableMinutes: durationMinutes - gracePeriodMinutes,
        gracePeriodMinutes,
    };
}

module.exports = { apply };
