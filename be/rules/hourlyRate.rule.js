// Feature: fee-calculation-engine
// Rule: Hourly Rate
// Requirements: 3.1, 3.4, 6.4

/**
 * @param {RuleContext} ctx
 * @param {FeeAccumulator} acc
 * @returns {FeeAccumulator}
 */
function apply(ctx, acc) {
    if (ctx.config.tiered_rate_enabled) {
        return acc;
    }

    return {
        ...acc,
        serviceFee: acc.billableHours * ctx.config.hourly_rate,
    };
}

module.exports = { apply };
