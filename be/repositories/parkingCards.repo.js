const { pool } = require("../config/db");

/**
 * Look up a pool card by its global card UID.
 * Returns the row ({ card_uid, lot_id, status, created_at }) or null if not found.
 * The "issued" state is derived by the caller (active session with that card_uid),
 * not by this function. The Assigned_Lot check (lot_id NULL or matching) is also
 * applied at the call site under the global identity model.
 */
async function getPoolCard(cardUid) {
    const query = `
        SELECT card_uid, lot_id, status, created_at
        FROM parking_cards
        WHERE card_uid = $1
        LIMIT 1
    `;

    const result = await pool.query(query, [cardUid]);
    return result.rows[0] || null;
}

/**
 * Mark a pool card as lost, keyed by its global card UID.
 * Called when a session bound to this card is finalized as a lost ticket.
 */
async function markLost(cardUid) {
    await pool.query(
        "UPDATE parking_cards SET status = 'lost' WHERE card_uid = $1",
        [cardUid]
    );
}

/**
 * List pool cards with their assigned-lot name (NULL lot_id = shared card).
 * When a non-empty search string is provided, only cards whose card_uid or
 * lot_name contains it (case-insensitive) are returned. Order is stable.
 */
async function listPoolCards(q) {
    const filter = typeof q === "string" && q.trim() !== "" ? q.trim() : null;

    const query = `
        SELECT pc.card_uid, pc.lot_id, pc.status, pc.created_at, pl.lot_name
        FROM parking_cards pc
        LEFT JOIN parkinglots pl ON pc.lot_id = pl.lot_id
        WHERE $1::text IS NULL
           OR pc.card_uid ILIKE '%' || $1 || '%'
           OR pl.lot_name ILIKE '%' || $1 || '%'
        ORDER BY pc.created_at DESC, pc.card_uid
    `;

    const result = await pool.query(query, [filter]);
    return result.rows;
}

/**
 * Insert a new pool card with status 'available'.
 * Pass lot = null for a shared card (valid at any lot).
 * Surfaces unique (23505) / foreign-key (23503) violations to the caller.
 */
async function insertPoolCard(uid, lot) {
    const query = `
        INSERT INTO parking_cards (card_uid, lot_id, status)
        VALUES ($1, $2, 'available')
        RETURNING card_uid, lot_id, status, created_at
    `;

    const result = await pool.query(query, [uid, lot]);
    return result.rows[0];
}

/**
 * Update a pool card's status, keyed by card UID.
 * Returns the updated row, or null when no card matched (0 rows).
 */
async function setStatus(uid, status) {
    const query = `
        UPDATE parking_cards
        SET status = $2
        WHERE card_uid = $1
        RETURNING card_uid, lot_id, status, created_at
    `;

    const result = await pool.query(query, [uid, status]);
    return result.rows[0] || null;
}

/**
 * Delete a pool card, keyed by card UID.
 * Returns the deleted row, or null when no card matched (0 rows).
 */
async function deletePoolCard(uid) {
    const query = `
        DELETE FROM parking_cards
        WHERE card_uid = $1
        RETURNING card_uid, lot_id, status, created_at
    `;

    const result = await pool.query(query, [uid]);
    return result.rows[0] || null;
}

/**
 * Whether a card UID currently backs an active parking session.
 * Reuses the exact predicate of the uq_active_session_card_uid partial index
 * (time_out IS NULL AND card_uid IS NOT NULL) — no new concurrency mechanism.
 */
async function hasActiveSession(uid) {
    const query = `
        SELECT 1
        FROM parkingsessions
        WHERE card_uid = $1 AND time_out IS NULL AND card_uid IS NOT NULL
        LIMIT 1
    `;

    const result = await pool.query(query, [uid]);
    return result.rowCount > 0;
}

/**
 * Pool inventory counts: total cards, and how many are available vs lost.
 * Counts are returned as integers.
 */
async function getInventoryCounts() {
    const query = `
        SELECT
            COUNT(*)                                  AS total,
            COUNT(*) FILTER (WHERE status = 'available') AS available,
            COUNT(*) FILTER (WHERE status = 'lost')      AS lost
        FROM parking_cards
    `;

    const result = await pool.query(query);
    const row = result.rows[0];
    return {
        total: parseInt(row.total, 10),
        available: parseInt(row.available, 10),
        lost: parseInt(row.lost, 10),
    };
}

module.exports = {
    getPoolCard,
    markLost,
    listPoolCards,
    insertPoolCard,
    setStatus,
    deletePoolCard,
    hasActiveSession,
    getInventoryCounts,
};
