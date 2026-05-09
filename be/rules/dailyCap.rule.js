// Feature: fee-calculation-engine
// Rule: Daily Cap
// Requirements: 5.1, 5.4, 5.5

/**
 * Return the start of the UTC calendar day (midnight UTC) for a given Date.
 * @param {Date} date
 * @returns {Date}
 */
function startOfUTCDay(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * @param {RuleContext} ctx
 * @param {FeeAccumulator} acc
 * @returns {FeeAccumulator}
 */
function apply(ctx, acc) {
    if (!ctx.config.daily_cap_enabled) {
        return acc;
    }

    const timeIn = new Date(ctx.session.time_in);
    const timeOut = new Date(ctx.session.time_out);
    const totalSessionMinutes = (timeOut - timeIn) / (1000 * 60);

    if (totalSessionMinutes <= 0) {
        return { ...acc, serviceFee: 0, dailyCapApplied: false };
    }

    const dailyCapAmount = ctx.config.daily_cap_amount;
    const currentServiceFee = acc.serviceFee;

    // Build UTC calendar day segments that the session spans
    const daySegmentMinutes = [];
    let cursor = startOfUTCDay(timeIn);

    while (cursor < timeOut) {
        const dayStart = new Date(cursor);
        const dayEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));

        const segStart = Math.max(timeIn.getTime(), dayStart.getTime());
        const segEnd = Math.min(timeOut.getTime(), dayEnd.getTime());
        const segMinutes = (segEnd - segStart) / (1000 * 60);

        daySegmentMinutes.push(segMinutes);
        cursor = dayEnd;
    }

    // Apply cap to each day's proportional fee
    let totalFee = 0;
    let capApplied = false;

    for (const dayMinutes of daySegmentMinutes) {
        const proportion = dayMinutes / totalSessionMinutes;
        const dayFee = proportion * currentServiceFee;

        if (dayFee > dailyCapAmount) {
            totalFee += dailyCapAmount;
            capApplied = true;
        } else {
            totalFee += dayFee;
        }
    }

    return { ...acc, serviceFee: totalFee, dailyCapApplied: capApplied };
}

module.exports = { apply };
