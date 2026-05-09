// Feature: fee-calculation-engine
// Rule: Tiered Rate
// Requirements: 6.1, 6.2, 6.5

/**
 * @param {RuleContext} ctx
 * @param {FeeAccumulator} acc
 * @returns {FeeAccumulator}
 */
function apply(ctx, acc) {
    if (!ctx.config.tiered_rate_enabled) {
        return acc;
    }

    const tiers = ctx.config.tiers || [];
    const billableHours = acc.billableHours;
    let totalFee = 0;
    let previousUpperBound = 0;

    for (const tier of tiers) {
        const upperBound = tier.up_to_hours != null ? tier.up_to_hours : Infinity;
        const hoursInBracket = Math.max(0, Math.min(billableHours, upperBound) - previousUpperBound);
        totalFee += hoursInBracket * tier.rate_per_hour;
        previousUpperBound = upperBound;

        if (billableHours <= upperBound) {
            break;
        }
    }

    return { ...acc, serviceFee: totalFee };
}

module.exports = { apply };
