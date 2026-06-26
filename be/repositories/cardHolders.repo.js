const { pool } = require("../config/db");

/**
 * Upsert a card holder (1 card -> 0..1 holder).
 * On conflict (card already has a holder), updates all fields + updated_at.
 * @param {string} cardUid
 * @param {Object} holder
 * @param {string} holder.holder_name
 * @param {string} holder.holder_phone
 * @param {string|null} holder.license_plate
 * @param {string|null} holder.vehicle_type
 * @param {Object} [client=pool] - DB client (for transactional use)
 * @returns {Object} upserted row
 */
async function upsertHolder(cardUid, { holder_name, holder_phone, license_plate, vehicle_type }, client = pool) {
    const query = `
        INSERT INTO card_holders (card_uid, holder_name, holder_phone, license_plate, vehicle_type)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (card_uid) DO UPDATE
            SET holder_name   = $2,
                holder_phone  = $3,
                license_plate = $4,
                vehicle_type  = $5,
                updated_at    = CURRENT_TIMESTAMP
        RETURNING *
    `;
    const result = await client.query(query, [
        cardUid,
        holder_name,
        holder_phone,
        license_plate || null,
        vehicle_type || null,
    ]);
    return result.rows[0];
}

/**
 * Get holder info for a card. Returns the row or null.
 * @param {string} cardUid
 * @param {Object} [client=pool]
 * @returns {Object|null}
 */
async function getHolder(cardUid, client = pool) {
    const result = await client.query(
        "SELECT * FROM card_holders WHERE card_uid = $1",
        [cardUid]
    );
    return result.rows[0] || null;
}

/**
 * Delete a card holder record.
 * Returns the deleted row or null if not found.
 * @param {string} cardUid
 * @param {Object} [client=pool]
 * @returns {Object|null}
 */
async function deleteHolder(cardUid, client = pool) {
    const result = await client.query(
        "DELETE FROM card_holders WHERE card_uid = $1 RETURNING *",
        [cardUid]
    );
    return result.rows[0] || null;
}

module.exports = {
    upsertHolder,
    getHolder,
    deleteHolder,
};
