const { pool } = require("../config/db");
const { PREVIEW_ROWS } = require("../config/constants");
const { parseWorkbook, CARD_COLUMNS, SUB_COLUMNS } = require("./xlsx.helper");
const parkingCardsRepo = require("../repositories/parkingCards.repo");
const cardHoldersRepo = require("../repositories/cardHolders.repo");

const ALLOWED_CARD_STATUS = ["available", "lost"];

/**
 * Whether a string is a well-formed YYYY-MM-DD calendar date.
 */
function isValidDateStr(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Today's date as a YYYY-MM-DD string (UTC).
 */
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Pure validator for card import rows.
 * Returns the COMPLETE list of Per_Row_Errors.
 *
 * @param {Array} rows - Parsed card rows (each with __row, card_uid, lot_id, status)
 * @param {Object} ref - { existingLotIds: Set<number>, existingCardUids: Set<string> }
 * @returns {Array} Per_Row_Error[]
 */
function validateCardRows(rows, ref) {
    const errors = [];
    const seenUids = new Set();

    for (const row of rows) {
        // Missing card_uid
        if (!row.card_uid) {
            errors.push({ row: row.__row, field: "card_uid", reason: "card_uid is required" });
        }

        // Invalid status (non-blank only)
        if (row.status && !ALLOWED_CARD_STATUS.includes(row.status.toLowerCase())) {
            errors.push({ row: row.__row, field: "status", reason: `status must be one of: ${ALLOWED_CARD_STATUS.join(", ")}` });
        }

        // lot_id validation (non-blank only)
        if (row.lot_id) {
            const lotIdNum = Number(row.lot_id);
            if (isNaN(lotIdNum) || !Number.isInteger(lotIdNum)) {
                errors.push({ row: row.__row, field: "lot_id", reason: "lot_id must be a numeric value or left blank for shared cards" });
            } else if (!ref.existingLotIds.has(lotIdNum)) {
                errors.push({ row: row.__row, field: "lot_id", reason: `lot_id ${row.lot_id} does not exist` });
            }
        }

        // In-file duplicate
        if (row.card_uid && seenUids.has(row.card_uid)) {
            errors.push({ row: row.__row, field: "card_uid", reason: `duplicate card_uid in file: ${row.card_uid}` });
        }

        // DB-existing duplicate
        if (row.card_uid && ref.existingCardUids.has(row.card_uid)) {
            errors.push({ row: row.__row, field: "card_uid", reason: `card_uid already exists in database: ${row.card_uid}` });
        }

        if (row.card_uid) seenUids.add(row.card_uid);
    }

    return errors;
}

/**
 * Map a PostgreSQL constraint error to a Per_Row_Error.
 */
function mapPgError(err) {
    if (err.code === "23505") {
        return { row: null, field: "card_uid", reason: "duplicate key constraint violation" };
    }
    if (err.code === "23503") {
        return { row: null, field: "lot_id", reason: "foreign key constraint violation" };
    }
    return { row: null, field: null, reason: err.message };
}

/**
 * Preview a card import file: parse → fetch ref → validate → return Preview_Result.
 * Never persists anything.
 */
async function previewCards(buffer) {
    const rows = await parseWorkbook(buffer, CARD_COLUMNS);
    const uids = rows.filter(r => r.card_uid).map(r => r.card_uid);
    const lotIds = rows.filter(r => r.lot_id).map(r => Number(r.lot_id)).filter(n => !isNaN(n));

    const [existingCardUids, existingLotIds] = await Promise.all([
        parkingCardsRepo.getExistingCardUids(uids),
        parkingCardsRepo.getExistingLotIds(lotIds),
    ]);

    const errors = validateCardRows(rows, { existingLotIds, existingCardUids });
    return {
        valid: errors.length === 0,
        totalRows: rows.length,
        errors,
        preview: rows.slice(0, PREVIEW_ROWS),
    };
}

/**
 * Commit a card import file: parse → fetch ref → validate → persist all-or-nothing.
 * If validation fails, returns { committed: false, errors } without opening a transaction.
 * On DB constraint error, rolls back and maps the error.
 */
async function commitCards(buffer) {
    const rows = await parseWorkbook(buffer, CARD_COLUMNS);
    const uids = rows.filter(r => r.card_uid).map(r => r.card_uid);
    const lotIds = rows.filter(r => r.lot_id).map(r => Number(r.lot_id)).filter(n => !isNaN(n));

    const [existingCardUids, existingLotIds] = await Promise.all([
        parkingCardsRepo.getExistingCardUids(uids),
        parkingCardsRepo.getExistingLotIds(lotIds),
    ]);

    const errors = validateCardRows(rows, { existingLotIds, existingCardUids });
    if (errors.length > 0) {
        return { committed: false, errors };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (const row of rows) {
            await parkingCardsRepo.insertPoolCard(
                row.card_uid, row.lot_id || null, row.status || "available", client
            );
        }
        await client.query("COMMIT");
        return { committed: true, count: rows.length };
    } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505" || err.code === "23503") {
            return { committed: false, errors: [mapPgError(err)] };
        }
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Pure validator for subs import rows (round-trip model).
 * action="" or blank → upsert (enable monthly + set holder)
 * action="cancel"   → cancel (disable monthly + delete holder)
 *
 * Returns the COMPLETE list of Per_Row_Errors (no short-circuit).
 *
 * @param {Array} rows - Parsed rows (each with __row, card_uid, monthly_end_date, holder_*, action)
 * @param {Object} ref - { existingCardUids: Set<string>, today: string }
 * @returns {Array} Per_Row_Error[]
 */
function validateSubRows(rows, ref) {
    const errors = [];
    const seenUids = new Set();

    for (const row of rows) {
        const action = (row.action || "").trim().toLowerCase();

        // card_uid existence
        if (!row.card_uid) {
            errors.push({ row: row.__row, field: "card_uid", reason: "card_uid is required" });
        } else if (!ref.existingCardUids.has(row.card_uid)) {
            errors.push({ row: row.__row, field: "card_uid", reason: "card_uid does not exist in the card pool" });
        }

        // action validity
        if (action && action !== "cancel") {
            errors.push({ row: row.__row, field: "action", reason: "action must be blank (upsert) or 'cancel'" });
        }

        // Upsert rows: validate date + holder pair
        if (!action) {
            // monthly_end_date required / valid / future
            if (!row.monthly_end_date) {
                errors.push({ row: row.__row, field: "monthly_end_date", reason: "monthly_end_date is required" });
            } else if (!isValidDateStr(row.monthly_end_date)) {
                errors.push({ row: row.__row, field: "monthly_end_date", reason: "monthly_end_date must be a valid YYYY-MM-DD date" });
            } else if (row.monthly_end_date <= ref.today) {
                errors.push({ row: row.__row, field: "monthly_end_date", reason: "monthly_end_date must be a future date" });
            }

            // Holder pair rule: if either holder_name or holder_phone is present, both required
            const hasName = row.holder_name && row.holder_name.trim() !== "";
            const hasPhone = row.holder_phone && row.holder_phone.trim() !== "";
            if (hasName && !hasPhone) {
                errors.push({ row: row.__row, field: "holder_phone", reason: "holder_phone is required when holder_name is provided" });
            }
            if (hasPhone && !hasName) {
                errors.push({ row: row.__row, field: "holder_name", reason: "holder_name is required when holder_phone is provided" });
            }
        }
        // Cancel rows: no extra validation needed (date/holder ignored)

        // In-file duplicate card_uid (occurrences after the first)
        if (row.card_uid && seenUids.has(row.card_uid)) {
            errors.push({ row: row.__row, field: "card_uid", reason: "duplicate card_uid in file" });
        }
        if (row.card_uid) seenUids.add(row.card_uid);
    }

    return errors;
}

/**
 * Preview a monthly-enable import file: parse → fetch existing cards → validate.
 * Never persists anything.
 */
async function previewSubs(buffer) {
    const rows = await parseWorkbook(buffer, SUB_COLUMNS);
    const uids = rows.filter(r => r.card_uid).map(r => r.card_uid);
    const existingCardUids = await parkingCardsRepo.getExistingCardUids(uids);

    const errors = validateSubRows(rows, { existingCardUids, today: todayStr() });
    return {
        valid: errors.length === 0,
        totalRows: rows.length,
        errors,
        preview: rows.slice(0, PREVIEW_ROWS),
    };
}

/**
 * Commit a subs import file (round-trip model): parse → validate → persist all-or-nothing.
 * action="" → enable monthly + upsert holder
 * action="cancel" → disable monthly + delete holder
 */
async function commitSubs(buffer) {
    const rows = await parseWorkbook(buffer, SUB_COLUMNS);
    const uids = rows.filter(r => r.card_uid).map(r => r.card_uid);
    const existingCardUids = await parkingCardsRepo.getExistingCardUids(uids);

    const errors = validateSubRows(rows, { existingCardUids, today: todayStr() });
    if (errors.length > 0) {
        return { committed: false, errors };
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (const row of rows) {
            const action = (row.action || "").trim().toLowerCase();

            if (action === "cancel") {
                // Disable monthly + delete holder
                await parkingCardsRepo.updateMonthly(
                    row.card_uid,
                    { is_monthly: false, monthly_end_date: null },
                    client
                );
                await cardHoldersRepo.deleteHolder(row.card_uid, client);
            } else {
                // Upsert: enable monthly + update holder
                await parkingCardsRepo.updateMonthly(
                    row.card_uid,
                    { is_monthly: true, monthly_end_date: row.monthly_end_date },
                    client
                );
                if (row.holder_name && row.holder_name.trim() !== "") {
                    await cardHoldersRepo.upsertHolder(
                        row.card_uid,
                        {
                            holder_name: row.holder_name.trim(),
                            holder_phone: row.holder_phone.trim(),
                            license_plate: row.license_plate || null,
                            vehicle_type: row.vehicle_type || null,
                        },
                        client
                    );
                }
            }
        }
        await client.query("COMMIT");
        return { committed: true, count: rows.length };
    } catch (err) {
        await client.query("ROLLBACK");
        if (err.code === "23505" || err.code === "23503") {
            return { committed: false, errors: [mapPgError(err)] };
        }
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    ALLOWED_CARD_STATUS,
    validateCardRows,
    validateSubRows,
    previewCards,
    commitCards,
    previewSubs,
    commitSubs,
};
