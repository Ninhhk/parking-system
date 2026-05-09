// Feature: fee-calculation-engine
// Rule: Rounding
// Requirements: 4.1, 4.2, 4.3

/**
 * @param {RuleContext} ctx
 * @param {FeeAccumulator} acc
 * @returns {FeeAccumulator}
 */
function apply(ctx, acc) {
    const min = acc.billableMinutes;
    let billableHours;

    switch (ctx.config.rounding_strategy) {
        case "ceil_hour":
            billableHours = Math.ceil(min / 60);
            break;
        case "ceil_half_hour":
            billableHours = Math.ceil(min / 30) / 2;
            break;
        case "exact_minutes":
            billableHours = min / 60;
            break;
        default:
            billableHours = Math.ceil(min / 60);
    }

    return { ...acc, billableHours };
}

module.exports = { apply };
