// Feature: fee-calculation-engine
// Pipeline runner
// Requirements: 1.1, 1.2, 1.4, 1.5, 1.6

const SERVICE_FEE_RULES = [
    require("../rules/gracePeriod.rule"),
    require("../rules/rounding.rule"),
    require("../rules/hourlyRate.rule"),
    require("../rules/tieredRate.rule"),
    require("../rules/timeOfDayRate.rule"),
    require("../rules/dailyCap.rule"),
];

const PENALTY_RULES = [
    require("../rules/lostTicketPenalty.rule"),
];

/**
 * Build the initial FeeAccumulator, seeding billableMinutes from session duration.
 * @param {RuleContext} ctx
 * @returns {FeeAccumulator}
 */
function initialAccumulator(ctx) {
    const timeIn = new Date(ctx.session.time_in);
    const timeOut = new Date(ctx.session.time_out);
    const billableMinutes = (timeOut - timeIn) / (1000 * 60);

    return {
        gracePeriodMinutes: 0,
        billableMinutes,
        billableHours: 0,
        serviceFee: 0,
        penaltyFee: 0,
        dailyCapApplied: false,
        totalAmount: 0,
        configVersionId: null,
    };
}

/**
 * Run the fee rule pipeline for a session.
 *
 * Monthly sessions bypass all SERVICE_FEE_RULES — the bypass is owned here,
 * not inside individual rules.
 *
 * @param {RuleContext} ctx
 * @param {boolean} isMonthly
 * @returns {FeeAccumulator}
 */
function runPipeline(ctx, isMonthly) {
    let acc = initialAccumulator(ctx);

    if (!isMonthly) {
        for (const rule of SERVICE_FEE_RULES) {
            acc = rule.apply(ctx, acc);
        }
    }

    for (const rule of PENALTY_RULES) {
        acc = rule.apply(ctx, acc);
    }

    acc.totalAmount = acc.serviceFee + acc.penaltyFee;
    acc.configVersionId = ctx.config.config_version_id;
    return acc;
}

/**
 * Construct a read-only RuleContext from a session row, active config, and
 * the current wall-clock time (used as time_out for in-progress sessions).
 *
 * Note: is_monthly is intentionally excluded — the pipeline runner handles it
 * before any rule executes.
 *
 * @param {object} session
 * @param {object} config
 * @param {Date}   currentTime
 * @returns {RuleContext}
 */
function buildContext(session, config, currentTime) {
    return {
        session: {
            session_id: session.session_id,
            vehicle_type: session.vehicle_type,
            time_in: session.time_in,
            time_out: currentTime,
            is_lost: session.is_lost,
        },
        config,
    };
}

module.exports = { runPipeline, buildContext };
