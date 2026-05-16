const { pool } = require("../config/db");
const feeConfigRepo = require("./admin.feeConfig.repo");
const { DEFAULT_PENALTY_FEE, UNKNOWN_GUEST_IDENTIFIER } = require("../config/constants");

let parkingSessionsColumnsCache = null;

async function getParkingSessionsColumns(client = pool) {
    if (parkingSessionsColumnsCache) {
        return parkingSessionsColumnsCache;
    }

    const result = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'parkingsessions'`
    );

    parkingSessionsColumnsCache = new Set(result.rows.map((row) => row.column_name));
    return parkingSessionsColumnsCache;
}

exports.startSession = async (sessionData, options = {}) => {
    const externalClient =
        options && typeof options.query === "function" ? options : options.client || null;
    const client = externalClient || (await pool.connect());
    const manageTransaction = !externalClient;

    try {
        if (manageTransaction) {
            await client.query("BEGIN");
        }

        const {
            lot_id,
            license_plate = null,
            card_uid = null,
            etag_epc = null,
            entry_lane_id = null,
            image_in_url = null,
            metadata_in = {},
            vehicle_type,
            is_monthly,
        } = sessionData;

        // Atomic capacity check: Update parking lot count with capacity constraint
        const column = vehicle_type.toLowerCase() === "car" ? "current_car" : "current_bike";
        const capacityColumn = vehicle_type.toLowerCase() === "car" ? "car_capacity" : "bike_capacity";

        const updateLotQuery = `
            UPDATE ParkingLots
            SET ${column} = ${column} + 1
            WHERE lot_id = $1
              AND ${column} < ${capacityColumn}
            RETURNING *
        `;

        const capacityResult = await client.query(updateLotQuery, [lot_id]);

        // If no rows updated, lot may be missing or at capacity
        if (capacityResult.rowCount === 0) {
            const lotExistsResult = await client.query(
                "SELECT 1 FROM ParkingLots WHERE lot_id = $1",
                [lot_id]
            );

            if (lotExistsResult.rowCount === 0) {
                const lotNotFoundError = new Error("Parking lot not found");
                lotNotFoundError.code = "LOT_NOT_FOUND";
                throw lotNotFoundError;
            }

            if (manageTransaction) {
                await client.query("ROLLBACK");
            }
            return null; // Signal capacity full to caller
        }

        const query = `
            INSERT INTO ParkingSessions (
                lot_id,
                license_plate,
                card_uid,
                etag_epc,
                entry_lane_id,
                image_in_url,
                metadata_in,
                vehicle_type,
                is_monthly,
                time_in,
                parking_fee
            ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW(), 0)
            RETURNING *
        `;

        const result = await client.query(query, [
            lot_id,
            license_plate,
            card_uid,
            etag_epc,
            entry_lane_id,
            image_in_url,
            JSON.stringify(metadata_in),
            vehicle_type,
            is_monthly,
        ]);

        // Commit the transaction
        if (manageTransaction) {
            await client.query("COMMIT");
        }

        return result.rows[0];
    } catch (error) {
        // Rollback in case of error
        if (manageTransaction) {
            try {
                await client.query("ROLLBACK");
            } catch (_rollbackError) {
            }
        }
        throw error;
    } finally {
        // Release the client
        if (manageTransaction) {
            client.release();
        }
    }
};


exports.getSession = async (sessionId) => {
    const query = `
        SELECT 
            ps.*,
            pl.lot_name,
            fc.service_fee,
            fc.penalty_fee
        FROM ParkingSessions ps
        JOIN ParkingLots pl ON ps.lot_id = pl.lot_id
        LEFT JOIN FeeConfigs fc ON ps.vehicle_type = fc.vehicle_type
        WHERE ps.session_id = $1 AND fc.ticket_type = 'daily'
    `;

    const result = await pool.query(query, [sessionId]);
    return result.rows[0];
};

exports.checkMonthlySub = async (license_plate, vehicle_type, current_date) => {
    const query = `
        SELECT * FROM MonthlySubs
        WHERE license_plate = $1
          AND vehicle_type  = $2
          AND start_date   <= $3
          AND end_date     >= $3
    `;

    const result = await pool.query(query, [license_plate, vehicle_type, current_date]);
    return result.rows[0];
};

// card_uid column was added to MonthlySubs via db/init/010_add_card_uid_to_monthly_subs.sql
exports.checkMonthlySubByCard = async (card_uid, vehicle_type, current_date) => {
    const query = `
        SELECT * FROM MonthlySubs
        WHERE card_uid    = $1
          AND vehicle_type = $2
          AND start_date  <= $3
          AND end_date    >= $3
    `;
    const result = await pool.query(query, [card_uid, vehicle_type, current_date]);
    return result.rows[0];
};

exports.createPendingPayment = async (paymentData) => {
    const { session_id, sub_id, total_amount } = paymentData;

    // Changed "Payments" to "Payment" to match your database schema
    const query = `
        INSERT INTO Payment (
            session_id,
            sub_id,
            payment_method,
            total_amount
        ) VALUES ($1, $2, 'PENDING', $3)
        RETURNING *
    `;

    const result = await pool.query(query, [session_id, sub_id || null, total_amount]);

    return result.rows[0];
};

exports.confirmPayment = async (paymentData) => {
    // Start a transaction
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { payment_id, payment_method, session_id, is_lost } = paymentData;

        // Update the payment - changed "Payments" to "Payment"
        const updatePaymentQuery = `
            UPDATE Payment
            SET 
                payment_method = $1,
                payment_date = NOW()
            WHERE payment_id = $2
            RETURNING *
        `;

        const paymentResult = await client.query(updatePaymentQuery, [payment_method, payment_id]);

        // Get session details
        const sessionQuery = `
            SELECT * FROM ParkingSessions
            WHERE session_id = $1
        `;

        const sessionResult = await client.query(sessionQuery, [session_id]);
        const session = sessionResult.rows[0];

        // Update the session
        const updateSessionQuery = `
            UPDATE ParkingSessions
            SET 
                time_out = NOW(),
                is_lost = $1
            WHERE session_id = $2
            RETURNING *
        `;

        const updatedSessionResult = await client.query(updateSessionQuery, [is_lost || false, session_id]);

        // Update the parking lot vehicle count
        const column = session.vehicle_type.toLowerCase() === "car" ? "current_car" : "current_bike";

        const updateLotQuery = `
            UPDATE ParkingLots
            SET ${column} = GREATEST(${column} - 1, 0)
            WHERE lot_id = $1
            RETURNING *
        `;

        await client.query(updateLotQuery, [session.lot_id]);

        // If lost ticket, create a report
        if (is_lost) {
            const lostTicketQuery = `
                INSERT INTO LostTicketReport (
                    session_id,
                    guest_identification,
                    guest_phone,
                    penalty_fee
                ) VALUES ($1, $2, $3, $4)
            `;

            // Use the penalty fee from the fee config or a default value
            const penaltyFee = session.penalty_fee || DEFAULT_PENALTY_FEE;

            await client.query(lostTicketQuery, [session_id, UNKNOWN_GUEST_IDENTIFIER, UNKNOWN_GUEST_IDENTIFIER, penaltyFee]);
        }

        // Commit the transaction
        await client.query("COMMIT");

        return {
            payment: paymentResult.rows[0],
            session: updatedSessionResult.rows[0],
        };
    } catch (error) {
        // Rollback in case of error
        await client.query("ROLLBACK");
        throw error;
    } finally {
        // Release the client
        client.release();
    }
};

exports.createAndConfirmPayment = async (paymentData) => {
    // Start a transaction
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { session_id, sub_id, total_amount, payment_method, is_lost } = paymentData;

        // Create the payment
        const createPaymentQuery = `
            INSERT INTO Payment (
                session_id,
                sub_id,
                payment_method,
                total_amount,
                payment_date
            ) VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `;

        const paymentResult = await client.query(createPaymentQuery, [
            session_id,
            sub_id || null,
            payment_method,
            total_amount,
        ]);

        // Get session details
        const sessionQuery = `
            SELECT * FROM ParkingSessions
            WHERE session_id = $1
        `;

        const sessionResult = await client.query(sessionQuery, [session_id]);
        const session = sessionResult.rows[0];

        // Update the session with time_out and parking_fee
        const updateSessionQuery = `
            UPDATE ParkingSessions
            SET 
                time_out = NOW(),
                is_lost = $1,
                parking_fee = $2
            WHERE session_id = $3
            RETURNING *
        `;

        const updatedSessionResult = await client.query(updateSessionQuery, [
            is_lost || false,
            total_amount,
            session_id,
        ]);

        // Update the parking lot vehicle count
        const column = session.vehicle_type.toLowerCase() === "car" ? "current_car" : "current_bike";

        const updateLotQuery = `
            UPDATE ParkingLots
            SET ${column} = GREATEST(${column} - 1, 0)
            WHERE lot_id = $1
            RETURNING *
        `;

        await client.query(updateLotQuery, [session.lot_id]);

        // Commit the transaction
        await client.query("COMMIT");

        return {
            payment: paymentResult.rows[0],
            session: updatedSessionResult.rows[0],
        };
    } catch (error) {
        // Rollback in case of error
        await client.query("ROLLBACK");
        throw error;
    } finally {
        // Release the client
        client.release();
    }
};

exports.getActiveSessionsByLot = async (lotId) => {
    const query = `
        SELECT * FROM ParkingSessions
        WHERE lot_id = $1 AND time_out IS NULL
        ORDER BY time_in DESC
    `;

    const result = await pool.query(query, [lotId]);
    return result.rows;
};

exports.getActiveSessionsForOps = async ({ laneId, q, page, pageSize } = {}, client = pool) => {
    const conditions = ["ps.time_out IS NULL"];
    const params = [];
    const columns = await getParkingSessionsColumns();

    if (laneId && columns.has("entry_lane_id")) {
        params.push(String(laneId).trim());
        conditions.push(`ps.entry_lane_id = $${params.length}`);
    }

    if (q && String(q).trim().length > 0) {
        const normalizedQuery = `%${String(q).trim()}%`;
        params.push(normalizedQuery);
        const qIndex = params.length;

        const searchConditions = [`ps.license_plate ILIKE $${qIndex}`];
        if (columns.has("card_uid")) {
            searchConditions.push(`ps.card_uid ILIKE $${qIndex}`);
        }
        if (columns.has("etag_epc")) {
            searchConditions.push(`ps.etag_epc ILIKE $${qIndex}`);
        }

        conditions.push(`(${searchConditions.join(" OR ")})`);
    }

    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);
    const normalizedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const normalizedPageSize = Number.isInteger(parsedPageSize) && parsedPageSize > 0 ? Math.min(parsedPageSize, 100) : 20;

    params.push(normalizedPageSize);
    const limitIndex = params.length;
    params.push((normalizedPage - 1) * normalizedPageSize);
    const offsetIndex = params.length;

    const result = await client.query(
        `SELECT ps.*
         FROM ParkingSessions ps
         WHERE ${conditions.join(" AND ")}
         ORDER BY ps.time_in DESC, ps.session_id DESC
         LIMIT $${limitIndex}
         OFFSET $${offsetIndex}`,
        params
    );

    return result.rows;
};

// Employee reports a lost ticket (standalone, not during checkout)
exports.reportLostTicket = async ({ session_id, guest_identification, guest_phone }) => {
    // Get session info to determine ticket_type and vehicle_type
    const sessionQuery = `SELECT * FROM ParkingSessions WHERE session_id = $1`;
    const sessionResult = await pool.query(sessionQuery, [session_id]);
    const session = sessionResult.rows[0];
    if (!session) throw new Error("Session not found");

    // Check if a lost ticket report already exists for this session
    const checkExistingQuery = `SELECT * FROM LostTicketReport WHERE session_id = $1`;
    const existingResult = await pool.query(checkExistingQuery, [session_id]);
    if (existingResult.rows.length > 0) {
        throw new Error("A lost ticket report already exists for this session");
    }

    // Assume ticket_type is 'daily' unless you have a field for it
    const ticket_type = session.is_monthly ? "monthly" : "daily";
    const vehicle_type = session.vehicle_type;
    // Get penalty fee from FeeConfigs
    const penalty_fee = await feeConfigRepo.getPenaltyFee(ticket_type, vehicle_type);
    const query = `
        INSERT INTO LostTicketReport (
            session_id,
            guest_identification,
            guest_phone,
            penalty_fee
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    const result = await pool.query(query, [session_id, guest_identification, guest_phone, penalty_fee]);
    return result.rows[0];
};

// Check if a session has a lost ticket report and update is_lost if needed
exports.syncLostTicketStatus = async (session_id) => {
    // Check if a lost ticket report exists for this session
    const checkQuery = `SELECT COUNT(*) FROM LostTicketReport WHERE session_id = $1`;
    const result = await pool.query(checkQuery, [session_id]);
    const hasLost = parseInt(result.rows[0].count, 10) > 0;
    if (hasLost) {
        // Update is_lost in ParkingSessions
        await pool.query(`UPDATE ParkingSessions SET is_lost = true WHERE session_id = $1`, [session_id]);
    }
    return hasLost;
};

exports.deleteLostTicketReportBySessionId = async (session_id) => {
    const query = `DELETE FROM LostTicketReport WHERE session_id = $1 RETURNING *`;
    const result = await pool.query(query, [session_id]);
    return result.rowCount > 0;
};

/**
 * Clears the lost ticket status for a session
 * @param {number|string} session_id - Session ID
 * @returns {Promise<boolean>} True if updated
 */
exports.clearLostTicketStatus = async (session_id) => {
    const query = `UPDATE ParkingSessions SET is_lost = false WHERE session_id = $1`;
    const result = await pool.query(query, [session_id]);
    return result.rowCount > 0;
};

exports.findActiveByCardUid = async (cardUid, client = pool) => {
    if (!cardUid) {
        return null;
    }

    const columns = await getParkingSessionsColumns();
    if (!columns.has("card_uid")) {
        return null;
    }

    const result = await client.query(
        `SELECT * FROM ParkingSessions
         WHERE card_uid = $1
           AND time_out IS NULL
         ORDER BY time_in DESC
         LIMIT 1`,
        [cardUid]
    );

    return result.rows[0] || null;
};

exports.findActiveByEtagEpc = async (etagEpc, client = pool) => {
    if (!etagEpc) {
        return null;
    }

    const columns = await getParkingSessionsColumns();
    if (!columns.has("etag_epc")) {
        return null;
    }

    const result = await client.query(
        `SELECT * FROM ParkingSessions
         WHERE etag_epc = $1
           AND time_out IS NULL
         ORDER BY time_in DESC
         LIMIT 1`,
        [etagEpc]
    );

    return result.rows[0] || null;
};

exports.findActiveByPlate = async (plate, client = pool) => {
    if (!plate) {
        return null;
    }

    const result = await client.query(
        `SELECT * FROM ParkingSessions
         WHERE license_plate = $1
           AND time_out IS NULL
         ORDER BY time_in DESC
         LIMIT 1`,
        [plate]
    );

    return result.rows[0] || null;
};

exports.enrichRecentSessionByLane = async (payload, options = pool) => {
    const laneId = payload?.laneId || payload?.entry_lane_id || null;
    const plate = payload?.plate || payload?.license_plate || null;
    const imageInUrl = payload?.imageInUrl ?? payload?.image_in_url;
    const metadataPatch = payload?.metadataPatch ?? payload?.metadata_patch;
    const windowSeconds = payload?.windowSeconds ?? payload?.window_seconds;
    const cardUid = payload?.cardUid ?? payload?.card_uid;
    const etagEpc = payload?.etagEpc ?? payload?.etag_epc;
    const client =
        options && typeof options.query === "function"
            ? options
            : options && options.client && typeof options.client.query === "function"
              ? options.client
              : pool;

    if (!laneId) {
        return null;
    }

    const columns = await getParkingSessionsColumns();
    if (!columns.has("entry_lane_id")) {
        return null;
    }

    const conditions = ["time_out IS NULL"];
    const params = [];

    params.push(laneId);
    conditions.push(`entry_lane_id = $${params.length}`);

    const normalizedWindowSeconds =
        Number.isInteger(windowSeconds) && windowSeconds > 0 ? windowSeconds : 120;
    params.push(normalizedWindowSeconds);
    conditions.push(`time_in >= NOW() - ($${params.length} * INTERVAL '1 second')`);

    const setClauses = [];

    if (columns.has("image_in_url") && imageInUrl !== undefined) {
        params.push(imageInUrl || null);
        setClauses.push(`image_in_url = $${params.length}`);
    }

    if (columns.has("license_plate") && plate) {
        params.push(plate);
        setClauses.push(`license_plate = COALESCE(license_plate, $${params.length})`);
    }

    if (columns.has("card_uid") && cardUid) {
        params.push(cardUid);
        setClauses.push(`card_uid = COALESCE(card_uid, $${params.length})`);
    }

    if (columns.has("etag_epc") && etagEpc) {
        params.push(etagEpc);
        setClauses.push(`etag_epc = COALESCE(etag_epc, $${params.length})`);
    }

    if (columns.has("metadata_in") && metadataPatch !== undefined) {
        params.push(JSON.stringify(metadataPatch || {}));
        setClauses.push(
            `metadata_in = COALESCE(metadata_in, '{}'::jsonb) || COALESCE($${params.length}::jsonb, '{}'::jsonb)`
        );
    }

    if (setClauses.length === 0) {
        return null;
    }

    try {
        const result = await client.query(
            `UPDATE ParkingSessions
             SET ${setClauses.join(", ")}
             WHERE session_id = (
                 SELECT session_id
                 FROM ParkingSessions
                 WHERE ${conditions.join(" AND ")}
                 ORDER BY time_in DESC
                 LIMIT 1
             )
             RETURNING *`,
            params
        );

        return result.rows[0] || null;
    } catch (error) {
        if (error && error.code === "42703") {
            return null;
        }
        throw error;
    }
};

exports.updateSessionImageUrl = async (sessionId, column, objectKey, client = pool) => {
    const allowedColumns = ["image_in_url", "image_out_url"];
    if (!allowedColumns.includes(column)) {
        throw new Error(`Invalid image column: ${column}`);
    }
    const result = await client.query(
        `UPDATE ParkingSessions SET ${column} = $1 WHERE session_id = $2 RETURNING session_id`,
        [objectKey, sessionId]
    );
    return result.rows[0] || null;
};

exports.closeSession = async (sessionId, client = pool) => {
    const result = await client.query(
        `UPDATE ParkingSessions
         SET time_out = NOW()
         WHERE session_id = $1 AND time_out IS NULL
         RETURNING *`,
        [sessionId]
    );
    const session = result.rows[0] || null;
    if (!session) return null;

    const column = (session.vehicle_type || "car").toLowerCase() === "car" ? "current_car" : "current_bike";
    await client.query(
        `UPDATE ParkingLots
         SET ${column} = GREATEST(${column} - 1, 0)
         WHERE lot_id = $1`,
        [session.lot_id]
    );

    return session;
};
