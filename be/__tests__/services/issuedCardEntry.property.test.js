const fc = require("fast-check");
const { evaluateIssuedCardEntry } = require("../../services/issuedCardEntry");

// Feature: card-pool-management, Property 1: Issued-card entry decision is correct for every card/lot combination
// Validates: Requirements 8.1, 8.2, 8.3, 8.4, 7.3

/**
 * Generators (per design):
 * - poolCard: null OR { status: oneof('available','lost'), lot_id: oneof(null, posInt) }
 * - employeeLotId: positive integer
 *
 * The oracle below restates the acceptance criteria independently of the
 * implementation: accept iff the card exists AND status !== 'lost' AND
 * (lot_id === null OR lot_id === employeeLotId); reject codes are
 * missing -> 422, lost -> 409, lot mismatch -> 422.
 */
const posInt = fc.integer({ min: 1, max: 1_000_000 });

const poolCardArb = fc.oneof(
    fc.constant(null),
    fc.record({
        status: fc.constantFrom("available", "lost"),
        lot_id: fc.oneof(fc.constant(null), posInt),
    })
);

function oracle(poolCard, employeeLotId) {
    if (!poolCard) return { accept: false, status: 422 };
    if (poolCard.status === "lost") return { accept: false, status: 409 };
    if (poolCard.lot_id !== null && poolCard.lot_id !== employeeLotId) {
        return { accept: false, status: 422 };
    }
    return { accept: true };
}

describe("Feature: card-pool-management, Property 1: Issued-card entry decision is correct for every card/lot combination", () => {
    it("accepts iff card exists, is not lost, and lot is shared or matching; otherwise rejects with the correct status", () => {
        fc.assert(
            fc.property(poolCardArb, posInt, (poolCard, employeeLotId) => {
                const result = evaluateIssuedCardEntry(poolCard, employeeLotId);
                const expected = oracle(poolCard, employeeLotId);

                expect(result.accept).toBe(expected.accept);

                if (expected.accept) {
                    // Accepted decisions carry no status/message.
                    expect(result.status).toBeUndefined();
                } else {
                    // Rejected decisions carry the exact HTTP status and a message.
                    expect(result.status).toBe(expected.status);
                    expect(typeof result.message).toBe("string");
                    expect(result.message.length).toBeGreaterThan(0);
                }
            }),
            { numRuns: 100 }
        );
    });
});
