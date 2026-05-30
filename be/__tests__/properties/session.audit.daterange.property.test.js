const fc = require("fast-check");

// Feature: session-audit-viewer, Property 4: Date range filter correctness
// Validates: Requirements 2.1, 2.2, 2.3

/**
 * Tests the correctness of the date range filtering logic.
 *
 * The repository uses:
 *   ps.time_in >= $2::date          (start date bound)
 *   ps.time_in < ($3::date + INTERVAL '1 day')  (end date bound, exclusive next day)
 *
 * We simulate this filter in-memory and verify:
 * - Every session in the filtered result has time_in >= startDate 00:00:00
 * - Every session in the filtered result has time_in < endDate + 1 day
 * - No session that satisfies both bounds is excluded from results
 */

// Generator: a YYYY-MM-DD string using integer-based approach (avoids Invalid Date)
// Days offset from 2020-01-01 (up to ~2190 days = ~6 years)
const dateArb = fc.integer({ min: 0, max: 2190 }).map(offset => {
    const d = new Date(Date.UTC(2020, 0, 1 + offset));
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
});

// Generator: a valid date range where startDate <= endDate
const dateRangeArb = fc.tuple(dateArb, dateArb).map(([a, b]) => {
    return a <= b ? { startDate: a, endDate: b } : { startDate: b, endDate: a };
});

// Generator: a random timestamp as a Date object (millisecond precision within a broad range)
// Range: 2019-06-01 to 2026-12-31 in UTC millis
const MIN_TS = Date.UTC(2019, 5, 1);  // 2019-06-01
const MAX_TS = Date.UTC(2026, 11, 31, 23, 59, 59); // 2026-12-31 23:59:59

const timestampArb = fc.integer({ min: MIN_TS, max: MAX_TS }).map(ms => new Date(ms));

// Generator: a session object with a random time_in timestamp
const sessionArb = timestampArb.map(timeIn => ({
    session_id: Math.floor(Math.random() * 10000),
    license_plate: "51F-123.45",
    vehicle_type: "car",
    lot_name: "Lot A",
    time_in: timeIn,
    time_out: null,
    is_lost: false,
    parking_fee: 0,
}));

/**
 * Simulates the PostgreSQL date range filter logic.
 * startDate: time_in >= startDate (as date, i.e., 00:00:00 UTC of that day)
 * endDate: time_in < endDate + 1 day (i.e., before 00:00:00 UTC of the next day)
 */
function simulateDateFilter(sessions, startDate, endDate) {
    return sessions.filter(s => {
        const timeIn = s.time_in;
        if (startDate) {
            const startBound = new Date(startDate + "T00:00:00Z");
            if (timeIn < startBound) return false;
        }
        if (endDate) {
            const endBound = new Date(endDate + "T00:00:00Z");
            endBound.setUTCDate(endBound.getUTCDate() + 1);
            if (timeIn >= endBound) return false;
        }
        return true;
    });
}

describe("Feature: session-audit-viewer, Property 4: Date range filter correctness", () => {
    it("every filtered session has time_in within the date range bounds", () => {
        fc.assert(
            fc.property(
                dateRangeArb,
                fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
                ({ startDate, endDate }, sessions) => {
                    const results = simulateDateFilter(sessions, startDate, endDate);
                    const startBound = new Date(startDate + "T00:00:00Z");
                    const endBound = new Date(endDate + "T00:00:00Z");
                    endBound.setUTCDate(endBound.getUTCDate() + 1);

                    return results.every(s => {
                        const timeIn = s.time_in;
                        return timeIn >= startBound && timeIn < endBound;
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    it("no session within bounds is excluded from results", () => {
        fc.assert(
            fc.property(
                dateRangeArb,
                fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
                ({ startDate, endDate }, sessions) => {
                    const results = simulateDateFilter(sessions, startDate, endDate);
                    const startBound = new Date(startDate + "T00:00:00Z");
                    const endBound = new Date(endDate + "T00:00:00Z");
                    endBound.setUTCDate(endBound.getUTCDate() + 1);

                    const excluded = sessions.filter(s => !results.includes(s));

                    // Every excluded session must be outside the bounds
                    return excluded.every(s => {
                        const timeIn = s.time_in;
                        return timeIn < startBound || timeIn >= endBound;
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    it("start-date-only filter: all results have time_in >= start date", () => {
        fc.assert(
            fc.property(
                dateArb,
                fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
                (startDate, sessions) => {
                    const results = simulateDateFilter(sessions, startDate, null);
                    const startBound = new Date(startDate + "T00:00:00Z");

                    return results.every(s => s.time_in >= startBound);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("end-date-only filter: all results have time_in < end date + 1 day", () => {
        fc.assert(
            fc.property(
                dateArb,
                fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
                (endDate, sessions) => {
                    const results = simulateDateFilter(sessions, null, endDate);
                    const endBound = new Date(endDate + "T00:00:00Z");
                    endBound.setUTCDate(endBound.getUTCDate() + 1);

                    return results.every(s => s.time_in < endBound);
                }
            ),
            { numRuns: 100 }
        );
    });
});
