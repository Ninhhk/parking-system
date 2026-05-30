const fc = require("fast-check");
const { deriveSessionStatus } = require("../../services/session.audit.service");

// Feature: session-audit-viewer, Property 7: Status derivation is deterministic and follows precedence
// Validates: Requirements 6.1, 6.2, 6.3, 6.4

/**
 * Generators:
 * - is_lost: random boolean
 * - time_out: nullable ISO date string (null, undefined, or valid date string)
 */
const nullableTimeOut = fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.integer({ min: 946684800000, max: 1924905600000 }).map(ts => new Date(ts).toISOString())
);

describe("Feature: session-audit-viewer, Property 7: Status derivation is deterministic and follows precedence", () => {
    it("is_lost=true always yields 'Lost Ticket' regardless of time_out", () => {
        fc.assert(
            fc.property(
                nullableTimeOut,
                (timeOut) => {
                    const session = { is_lost: true, time_out: timeOut };
                    const status = deriveSessionStatus(session);
                    return status === "Lost Ticket";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("is_lost=false with non-null time_out yields 'Completed'", () => {
        fc.assert(
            fc.property(
                fc.date().map(d => d.toISOString()),
                (timeOut) => {
                    const session = { is_lost: false, time_out: timeOut };
                    const status = deriveSessionStatus(session);
                    return status === "Completed";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("is_lost=false with null/undefined time_out yields 'Active'", () => {
        fc.assert(
            fc.property(
                fc.oneof(fc.constant(null), fc.constant(undefined)),
                (timeOut) => {
                    const session = { is_lost: false, time_out: timeOut };
                    const status = deriveSessionStatus(session);
                    return status === "Active";
                }
            ),
            { numRuns: 100 }
        );
    });

    it("always returns exactly one of the three valid statuses for any (is_lost, time_out) combination", () => {
        const VALID_STATUSES = ["Lost Ticket", "Completed", "Active"];

        fc.assert(
            fc.property(
                fc.boolean(),
                nullableTimeOut,
                (isLost, timeOut) => {
                    const session = { is_lost: isLost, time_out: timeOut };
                    const status = deriveSessionStatus(session);
                    return VALID_STATUSES.includes(status);
                }
            ),
            { numRuns: 100 }
        );
    });

    it("is deterministic - same input always produces same output", () => {
        fc.assert(
            fc.property(
                fc.boolean(),
                nullableTimeOut,
                (isLost, timeOut) => {
                    const session = { is_lost: isLost, time_out: timeOut };
                    const first = deriveSessionStatus(session);
                    const second = deriveSessionStatus(session);
                    return first === second;
                }
            ),
            { numRuns: 100 }
        );
    });
});
