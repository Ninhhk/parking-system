const { pool } = require("../config/db");

/**
 * Look up a pool card by lot and card UID.
 * Returns the row ({ card_uid, lot_id, status, created_at }) or null if not found.
 * The "issued" state is derived by the caller (active session with that card_uid),
 * not by this function.
 */
async function getPoolCard(lotId, cardUid) {
    const query = `
        SELECT card_uid, lot_id, status, created_at
        FROM parking_cards
        WHERE lot_id = $1 AND card_uid = $2
        LIMIT 1
    `;

    const result = await pool.query(query, [lotId, cardUid]);
    return result.rows[0] || null;
}

/**
 * Mark a pool card as lost.
 * Called when a session bound to this card is finalized as a lost ticket.
 */
async function markLost(lotId, cardUid) {
    await pool.query(
        "UPDATE parking_cards SET status = 'lost' WHERE lot_id = $1 AND card_uid = $2",
        [lotId, cardUid]
    );
}

module.exports = { getPoolCard, markLost };
