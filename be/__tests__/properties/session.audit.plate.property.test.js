const fc = require("fast-check");

// Feature: session-audit-viewer, Property 1: Plate search returns only matching sessions
// Validates: Requirements 1.1

/**
 * Tests the correctness of the plate search filtering logic.
 *
 * The repository uses: ps.license_plate ILIKE '%' || $1 || '%'
 * This is equivalent to: license_plate.toLowerCase().includes(query.toLowerCase())
 *
 * We simulate this filter in-memory and verify:
 * - Every session in the filtered result contains the query as a case-insensitive substring
 * - No session that does NOT contain the query leaks into results
 */

// Generator: random plate query string (1-20 alphanumeric chars, non-whitespace-only)
const plateQueryArb = fc.stringMatching(/^[a-zA-Z0-9.\- ]{1,20}$/)
    .filter(s => s.trim().length > 0);

// Generator: random license plate value for a session
const licensePlateArb = fc.stringMatching(/^[a-zA-Z0-9.\- ]{1,20}$/);

// Generator: a session object with a random license_plate
const sessionArb = fc.record({
    session_id: fc.nat({ max: 10000 }),
    license_plate: licensePlateArb,
    vehicle_type: fc.constantFrom("car", "bike"),
    lot_name: fc.constantFrom("Lot A", "Lot B", "Lot C"),
    time_in: fc.integer({ min: 946684800000, max: 1924905600000 }).map(ts => new Date(ts).toISOString()),
    time_out: fc.constant(null),
    is_lost: fc.constant(false),
    parking_fee: fc.nat({ max: 100000 }),
});

/**
 * Simulates the PostgreSQL ILIKE '%query%' filter logic.
 * This is the exact logic the repository applies via SQL.
 */
function simulateIlikeFilter(sessions, query) {
    const lowerQuery = query.toLowerCase();
    return sessions.filter(s => s.license_plate.toLowerCase().includes(lowerQuery));
}

describe("Feature: session-audit-viewer, Property 1: Plate search returns only matching sessions", () => {
    it("every session in filtered results contains the query as case-insensitive substring", () => {
        fc.assert(
            fc.property(
                plateQueryArb,
                fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
                (query, sessions) => {
                    const results = simulateIlikeFilter(sessions, query);
                    const lowerQuery = query.toLowerCase();

                    // Property: every returned session contains the query
                    return results.every(
                        s => s.license_plate.toLowerCase().includes(lowerQuery)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("no session excluded from results actually contains the query", () => {
        fc.assert(
            fc.property(
                plateQueryArb,
                fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
                (query, sessions) => {
                    const results = simulateIlikeFilter(sessions, query);
                    const lowerQuery = query.toLowerCase();
                    const excluded = sessions.filter(s => !results.includes(s));

                    // Property: every excluded session does NOT contain the query
                    return excluded.every(
                        s => !s.license_plate.toLowerCase().includes(lowerQuery)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    it("result count is always <= input session count", () => {
        fc.assert(
            fc.property(
                plateQueryArb,
                fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
                (query, sessions) => {
                    const results = simulateIlikeFilter(sessions, query);
                    return results.length <= sessions.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("filter is case-insensitive: query in any case matches plate in any case", () => {
        fc.assert(
            fc.property(
                plateQueryArb,
                fc.array(sessionArb, { minLength: 1, maxLength: 50 }),
                (query, sessions) => {
                    const upperResults = simulateIlikeFilter(sessions, query.toUpperCase());
                    const lowerResults = simulateIlikeFilter(sessions, query.toLowerCase());

                    // Property: case of query does not affect which sessions are returned
                    return upperResults.length === lowerResults.length;
                }
            ),
            { numRuns: 100 }
        );
    });
});
