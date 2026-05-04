// Feature: fee-calculation-engine
// Rule: Time-of-Day Rate
// Requirements: 7.1, 7.4, 7.5

/**
 * Parse "HH:MM" into total minutes since midnight.
 * @param {string} timeStr
 * @returns {number}
 */
function parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
}

/**
 * Compute the number of minutes within a session (expressed as minutes since
 * midnight on the session's start day) that fall inside a time window.
 *
 * Both sessionStart and sessionEnd are minutes since midnight (may exceed 1440
 * for multi-day sessions; this function handles one 24-hour cycle at a time).
 *
 * windowStart and windowEnd are minutes since midnight (0–1439).
 * When windowEnd <= windowStart the window crosses midnight.
 *
 * @param {number} sessionStart  minutes since midnight (within one day cycle)
 * @param {number} sessionEnd    minutes since midnight (within one day cycle, >= sessionStart)
 * @param {number} windowStart   minutes since midnight
 * @param {number} windowEnd     minutes since midnight
 * @returns {number}
 */
function minutesInWindow(sessionStart, sessionEnd, windowStart, windowEnd) {
    if (windowEnd > windowStart) {
        // Normal window (e.g. 08:00–18:00)
        const overlapStart = Math.max(sessionStart, windowStart);
        const overlapEnd = Math.min(sessionEnd, windowEnd);
        return Math.max(0, overlapEnd - overlapStart);
    } else {
        // Midnight-crossing window (e.g. 22:00–06:00)
        // Split into [windowStart, 1440) and [0, windowEnd)
        const overlapNight = Math.max(0, Math.min(sessionEnd, 1440) - Math.max(sessionStart, windowStart));
        const overlapMorning = Math.max(0, Math.min(sessionEnd, windowEnd) - Math.max(sessionStart, 0));
        return Math.max(0, overlapNight) + Math.max(0, overlapMorning);
    }
}

/**
 * @param {RuleContext} ctx
 * @param {FeeAccumulator} acc
 * @returns {FeeAccumulator}
 */
function apply(ctx, acc) {
    if (!ctx.config.time_of_day_enabled) {
        return acc;
    }

    const windows = ctx.config.time_windows || [];
    const timeIn = new Date(ctx.session.time_in);
    const timeOut = new Date(ctx.session.time_out);
    const totalSessionMinutes = (timeOut - timeIn) / (1000 * 60);

    if (totalSessionMinutes <= 0) {
        return { ...acc, serviceFee: 0 };
    }

    // Work in minutes since midnight of the session start day.
    // We iterate minute-by-minute via fractional accounting instead of a loop
    // to keep it O(windows) rather than O(minutes).
    //
    // Strategy: for each time window, compute the total minutes of the session
    // that fall inside it (across all calendar days spanned). The remainder
    // uses multiplier 1.0.

    const startOfDay = new Date(Date.UTC(timeIn.getUTCFullYear(), timeIn.getUTCMonth(), timeIn.getUTCDate()));
    const sessionStartMinutes = (timeIn - startOfDay) / (1000 * 60);
    const sessionEndMinutes = sessionStartMinutes + totalSessionMinutes;

    // Accumulate minutes per window across all 1440-minute day cycles
    const windowMinutes = windows.map(() => 0);

    // Number of complete 1440-minute cycles
    const totalCycles = Math.ceil(sessionEndMinutes / 1440);

    for (let cycle = 0; cycle < totalCycles; cycle++) {
        const cycleStart = cycle * 1440;
        const cycleEnd = cycleStart + 1440;

        // Session portion within this cycle (relative to start of cycle)
        const segStart = Math.max(sessionStartMinutes, cycleStart) - cycleStart;
        const segEnd = Math.min(sessionEndMinutes, cycleEnd) - cycleStart;

        if (segEnd <= segStart) continue;

        for (let w = 0; w < windows.length; w++) {
            const win = windows[w];
            const winStart = parseTimeToMinutes(win.start_time);
            const winEnd = parseTimeToMinutes(win.end_time);
            windowMinutes[w] += minutesInWindow(segStart, segEnd, winStart, winEnd);
        }
    }

    // Minutes covered by at least one window (for simplicity, windows are
    // treated as non-overlapping per the spec — up to 3 windows).
    const totalWindowMinutes = windowMinutes.reduce((s, m) => s + m, 0);
    const outsideMinutes = totalSessionMinutes - totalWindowMinutes;

    // Compute weighted serviceFee:
    // serviceFee = sum(fraction_in_window * billableHours * hourly_rate * multiplier)
    //            + fraction_outside * billableHours * hourly_rate * 1.0
    const hourlyRate = ctx.config.hourly_rate;
    const billableHours = acc.billableHours;

    let serviceFee = (outsideMinutes / totalSessionMinutes) * billableHours * hourlyRate;

    for (let w = 0; w < windows.length; w++) {
        const fraction = windowMinutes[w] / totalSessionMinutes;
        serviceFee += fraction * billableHours * hourlyRate * windows[w].rate_multiplier;
    }

    return { ...acc, serviceFee };
}

module.exports = { apply };
