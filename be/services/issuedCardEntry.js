// Feature: card-pool-management
// Requirements: 8.1, 8.2, 8.3, 8.4, 7.3

/**
 * Decides whether an issued-card check-in should be accepted, under the global
 * card identity model. Pure function with no I/O so it can be reused by the
 * check-in controller and exercised directly by property tests.
 *
 * Accept iff the card exists AND its status is not "lost" AND its assigned lot
 * is shared (null) or matches the employee's lot. Otherwise reject with the
 * matching HTTP status:
 *   - missing card   -> 422 "Card not recognized"      (Req 8.2)
 *   - status "lost"  -> 409 "Card unavailable"         (Req 8.3)
 *   - lot mismatch   -> 422 "Card not valid at this lot" (Req 8.4)
 *
 * @param {Object|null} poolCard - Pool_Card row ({ status, lot_id, ... }) or null when absent
 * @param {number} employeeLotId - The lot id of the employee performing the check-in
 * @returns {{ accept: true } | { accept: false, status: number, message: string }}
 */
function evaluateIssuedCardEntry(poolCard, employeeLotId) {
    if (!poolCard) {
        return { accept: false, status: 422, message: "Card not recognized" };
    }
    if (poolCard.status === "lost") {
        return { accept: false, status: 409, message: "Card unavailable" };
    }
    if (poolCard.lot_id !== null && poolCard.lot_id !== employeeLotId) {
        return { accept: false, status: 422, message: "Card not valid at this lot" };
    }
    return { accept: true };
}

module.exports = { evaluateIssuedCardEntry };
