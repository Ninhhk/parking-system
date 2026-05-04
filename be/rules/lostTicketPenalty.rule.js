// Feature: fee-calculation-engine
// Rule: Lost Ticket Penalty
// Requirements: 8.1, 8.3

/**
 * @param {RuleContext} ctx
 * @param {FeeAccumulator} acc
 * @returns {FeeAccumulator}
 */
function apply(ctx, acc) {
    if (!ctx.session.is_lost) {
        return acc;
    }

    return {
        ...acc,
        penaltyFee: acc.penaltyFee + ctx.config.penalty_fee,
    };
}

module.exports = { apply };
